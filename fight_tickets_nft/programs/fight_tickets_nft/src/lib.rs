use anchor_lang::prelude::*;
use solana_program::{
    ed25519_program,
    hash::hashv,
    sysvar::instructions::{load_instruction_at_checked, ID as SYSVAR_INSTRUCTIONS_ID},
};

declare_id!("6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG");

const MAX_SUPPLY: u32 = 10000;

#[program]
pub mod fight_tickets_nft {
    use super::*;

    /// Initialize the NFT collection
    pub fn initialize(ctx: Context<Initialize>, signer: Pubkey, base_uri: String) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        collection.authority = ctx.accounts.authority.key();
        collection.signer = signer;
        collection.is_locked = false;
        collection.total_supply = 0;
        collection.base_uri = base_uri;
        
        msg!("NFT Collection initialized with authority: {}", collection.authority);
        Ok(())
    }

    /// Claim an NFT with a valid proof
    pub fn claim(
        ctx: Context<Claim>,
        proof: [u8; 64],
        nft_id: u32,
        recipient: Pubkey,
    ) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        
        // Check if contract is locked
        require!(!collection.is_locked, ErrorCode::ContractLocked);
        
        // Validate NFT ID range
        require!(nft_id < MAX_SUPPLY, ErrorCode::NftIdOutOfRange);
        
        // Verify the proof signature using ed25519_program
        verify_ed25519_signature(
            &proof,
            recipient,
            nft_id,
            &collection.signer,
            &ctx.accounts.instruction_sysvar,
        )?;
        
        // Initialize NFT account
        let nft = &mut ctx.accounts.nft;
        nft.nft_id = nft_id;
        nft.owner = recipient;
        nft.collection = collection.key();
        
        // Update collection supply
        collection.total_supply = collection.total_supply.checked_add(1).unwrap();
        
        emit!(ClaimEvent {
            nft_id,
            recipient,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("NFT #{} claimed by {}", nft_id, recipient);
        Ok(())
    }

    /// Transfer NFT (operator only)
    pub fn transfer(
        ctx: Context<Transfer>,
        _nft_id: u32,
        new_owner: Pubkey,
    ) -> Result<()> {
        let collection = &ctx.accounts.collection;
        
        // Check if contract is locked
        require!(!collection.is_locked, ErrorCode::ContractLocked);
        
        // Only operator can transfer (soulbound for regular holders)
        require!(
            ctx.accounts.authority.key() == collection.authority,
            ErrorCode::Unauthorized
        );
        
        let nft = &mut ctx.accounts.nft;
        let old_owner = nft.owner;
        nft.owner = new_owner;
        
        emit!(TransferEvent {
            nft_id: nft.nft_id,
            from: old_owner,
            to: new_owner,
            operator: ctx.accounts.authority.key(),
        });
        
        msg!("NFT #{} transferred from {} to {} by operator", nft.nft_id, old_owner, new_owner);
        Ok(())
    }

    /// Burn an NFT (operator only)
    pub fn burn(ctx: Context<Burn>, _nft_id: u32) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        
        // Check if contract is locked
        require!(!collection.is_locked, ErrorCode::ContractLocked);
        
        // Only operator can burn
        require!(
            ctx.accounts.authority.key() == collection.authority,
            ErrorCode::Unauthorized
        );
        
        let nft = &ctx.accounts.nft;
        let nft_id = nft.nft_id;
        
        // Update collection supply
        collection.total_supply = collection.total_supply.checked_sub(1).unwrap();
        
        emit!(BurnEvent {
            nft_id,
            operator: ctx.accounts.authority.key(),
        });
        
        msg!("NFT #{} burned by operator", nft_id);
        Ok(())
    }

    /// Update the signer public key (operator only)
    pub fn update_signer(ctx: Context<UpdateSigner>, new_signer: Pubkey) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        
        // Check if contract is locked
        require!(!collection.is_locked, ErrorCode::ContractLocked);
        
        // Only operator can update signer
        require!(
            ctx.accounts.authority.key() == collection.authority,
            ErrorCode::Unauthorized
        );
        
        let old_signer = collection.signer;
        collection.signer = new_signer;
        
        emit!(SignerUpdatedEvent {
            old_signer,
            new_signer,
            operator: ctx.accounts.authority.key(),
        });
        
        msg!("Signer updated from {} to {} by operator", old_signer, new_signer);
        Ok(())
    }

    /// Update the base URI for metadata (operator only)
    pub fn update_base_uri(ctx: Context<UpdateBaseUri>, new_base_uri: String) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        
        // Check if contract is locked
        require!(!collection.is_locked, ErrorCode::ContractLocked);
        
        // Only operator can update base URI
        require!(
            ctx.accounts.authority.key() == collection.authority,
            ErrorCode::Unauthorized
        );
        
        let old_base_uri = collection.base_uri.clone();
        collection.base_uri = new_base_uri.clone();
        
        emit!(BaseUriUpdatedEvent {
            old_base_uri,
            new_base_uri,
            operator: ctx.accounts.authority.key(),
        });
        
        msg!("Base URI updated by operator");
        Ok(())
    }

    /// Lock the contract permanently (operator only)
    pub fn lock_contract(ctx: Context<LockContract>) -> Result<()> {
        let collection = &mut ctx.accounts.collection;
        
        // Only operator can lock
        require!(
            ctx.accounts.authority.key() == collection.authority,
            ErrorCode::Unauthorized
        );
        
        collection.is_locked = true;
        
        emit!(LockEvent {
            operator: ctx.accounts.authority.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        msg!("Contract locked permanently by operator");
        Ok(())
    }
}

// Helper function to verify Ed25519 signature using ed25519_program syscall
fn verify_ed25519_signature(
    signature: &[u8; 64],
    recipient: Pubkey,
    nft_id: u32,
    expected_signer: &Pubkey,
    instruction_sysvar: &AccountInfo,
) -> Result<()> {
    // Create the message that should have been signed: hash(recipient + nft_id)
    let mut message_data = Vec::new();
    message_data.extend_from_slice(&recipient.to_bytes());
    message_data.extend_from_slice(&nft_id.to_le_bytes());
    
    // Hash the message with SHA-256
    let message_hash = hashv(&[&message_data]);
    
    // The ed25519 signature verification instruction should be at index 0
    // It must be passed in the same transaction before this instruction
    let ix = load_instruction_at_checked(0, instruction_sysvar)
        .map_err(|_| ErrorCode::InvalidProof)?;
    
    // Verify the instruction is calling the ed25519_program
    require!(
        ix.program_id == ed25519_program::ID,
        ErrorCode::InvalidProof
    );
    
    // Ed25519 instruction data format:
    // [0]: number of signatures (u8)
    // [1]: padding (u8)
    // [2-3]: signature offset (u16 LE)
    // [4-5]: signature instruction index (u16 LE)
    // [6-7]: public key offset (u16 LE)
    // [8-9]: public key instruction index (u16 LE)
    // [10-11]: message data offset (u16 LE)
    // [12-13]: message data size (u16 LE)
    // [14-15]: message instruction index (u16 LE)
    // Then the actual signature, public key, and message data
    
    require!(ix.data.len() >= 16, ErrorCode::InvalidProof);
    
    // Check number of signatures is 1
    require!(ix.data[0] == 1, ErrorCode::InvalidProof);
    
    // Parse offsets
    let sig_offset = u16::from_le_bytes([ix.data[2], ix.data[3]]) as usize;
    let pubkey_offset = u16::from_le_bytes([ix.data[6], ix.data[7]]) as usize;
    let message_offset = u16::from_le_bytes([ix.data[10], ix.data[11]]) as usize;
    let message_size = u16::from_le_bytes([ix.data[12], ix.data[13]]) as usize;
    
    // Verify data is present
    require!(
        sig_offset + 64 <= ix.data.len(),
        ErrorCode::InvalidProof
    );
    require!(
        pubkey_offset + 32 <= ix.data.len(),
        ErrorCode::InvalidProof
    );
    require!(
        message_offset + message_size <= ix.data.len(),
        ErrorCode::InvalidProof
    );
    require!(message_size == 32, ErrorCode::InvalidProof);
    
    // Extract signature from instruction data
    let sig_from_ix = &ix.data[sig_offset..sig_offset + 64];
    
    // Extract public key from instruction data
    let pubkey_from_ix = &ix.data[pubkey_offset..pubkey_offset + 32];
    
    // Extract message from instruction data
    let message_from_ix = &ix.data[message_offset..message_offset + message_size];
    
    // Verify the signature matches what was passed
    require!(
        sig_from_ix == signature,
        ErrorCode::InvalidProof
    );
    
    // Verify the public key matches the expected signer
    require!(
        pubkey_from_ix == expected_signer.to_bytes(),
        ErrorCode::InvalidProof
    );
    
    // Verify the message matches what we expect
    require!(
        message_from_ix == message_hash.to_bytes(),
        ErrorCode::InvalidProof
    );
    
    // If all checks pass, the ed25519_program has already verified the signature
    // We just needed to confirm the parameters match our expectations
    Ok(())
}

// Account Structures

#[account]
pub struct NftCollection {
    pub authority: Pubkey,      // Operator address (32)
    pub signer: Pubkey,          // API public key for proof verification (32)
    pub is_locked: bool,         // Contract lock status (1)
    pub total_supply: u32,       // Current supply (4)
    pub base_uri: String,        // Base URI for metadata (4 + up to 200 chars)
}

impl NftCollection {
    pub const LEN: usize = 8 + 32 + 32 + 1 + 4 + (4 + 200) + 100; // discriminator + data + base_uri + padding
}

#[account]
pub struct Nft {
    pub nft_id: u32,             // NFT ID (4)
    pub owner: Pubkey,           // Owner address (32)
    pub collection: Pubkey,      // Collection address (32)
}

impl Nft {
    pub const LEN: usize = 8 + 4 + 32 + 32 + 50; // discriminator + data + padding
}

// Context Structures

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = NftCollection::LEN
    )]
    pub collection: Account<'info, NftCollection>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proof: [u8; 64], nft_id: u32, recipient: Pubkey)]
pub struct Claim<'info> {
    #[account(mut)]
    pub collection: Account<'info, NftCollection>,
    
    #[account(
        init,
        payer = payer,
        space = Nft::LEN,
        seeds = [
            b"nft",
            collection.key().as_ref(),
            &nft_id.to_le_bytes()
        ],
        bump
    )]
    pub nft: Account<'info, Nft>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    /// CHECK: This is the sysvar account for instructions
    #[account(address = SYSVAR_INSTRUCTIONS_ID)]
    pub instruction_sysvar: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nft_id: u32, new_owner: Pubkey)]
pub struct Transfer<'info> {
    #[account(
        constraint = collection.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub collection: Account<'info, NftCollection>,
    
    #[account(
        mut,
        seeds = [
            b"nft",
            collection.key().as_ref(),
            &nft_id.to_le_bytes()
        ],
        bump,
        constraint = nft.owner == from.key() @ ErrorCode::InvalidOwner
    )]
    pub nft: Account<'info, Nft>,
    
    /// CHECK: Current owner of the NFT
    pub from: AccountInfo<'info>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(nft_id: u32)]
pub struct Burn<'info> {
    #[account(
        mut,
        constraint = collection.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub collection: Account<'info, NftCollection>,
    
    #[account(
        mut,
        seeds = [
            b"nft",
            collection.key().as_ref(),
            &nft_id.to_le_bytes()
        ],
        bump,
        close = recipient
    )]
    pub nft: Account<'info, Nft>,
    
    pub authority: Signer<'info>,
    
    /// CHECK: Recipient of the closed account lamports
    #[account(mut)]
    pub recipient: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct LockContract<'info> {
    #[account(
        mut,
        constraint = collection.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub collection: Account<'info, NftCollection>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateSigner<'info> {
    #[account(
        mut,
        constraint = collection.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub collection: Account<'info, NftCollection>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateBaseUri<'info> {
    #[account(
        mut,
        constraint = collection.authority == authority.key() @ ErrorCode::Unauthorized
    )]
    pub collection: Account<'info, NftCollection>,
    
    pub authority: Signer<'info>,
}

// Events

#[event]
pub struct ClaimEvent {
    pub nft_id: u32,
    pub recipient: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TransferEvent {
    pub nft_id: u32,
    pub from: Pubkey,
    pub to: Pubkey,
    pub operator: Pubkey,
}

#[event]
pub struct BurnEvent {
    pub nft_id: u32,
    pub operator: Pubkey,
}

#[event]
pub struct LockEvent {
    pub operator: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct SignerUpdatedEvent {
    pub old_signer: Pubkey,
    pub new_signer: Pubkey,
    pub operator: Pubkey,
}

#[event]
pub struct BaseUriUpdatedEvent {
    pub old_base_uri: String,
    pub new_base_uri: String,
    pub operator: Pubkey,
}

// Error Codes

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid proof signature")]
    InvalidProof,
    
    #[msg("NFT ID out of range (must be 0-9999)")]
    NftIdOutOfRange,
    
    #[msg("Unauthorized: only operator can perform this action")]
    Unauthorized,
    
    #[msg("Contract is locked")]
    ContractLocked,
    
    #[msg("Invalid owner")]
    InvalidOwner,
}

