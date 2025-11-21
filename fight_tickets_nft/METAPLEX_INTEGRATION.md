# Metaplex Token Metadata Integration

Your NFT program now includes full Metaplex Token Metadata support, which means your NFTs will display properly in all Solana block explorers (Solscan, Solana FM, etc.) and wallets (Phantom, Solflare, etc.).

## What Changed

### 1. Dependencies Added
- `mpl-token-metadata` v4.1.2 - The official Metaplex metadata library
- Anchor version updated to v0.30.1 for compatibility

### 2. NFT Structure Enhanced
Each NFT now includes:
- **Metadata Account**: Contains name, symbol, URI, creators, and collection reference
- **Master Edition Account**: Makes each NFT a unique 1/1 edition (non-fungible)
- **Collection Reference**: Links NFTs to the collection for proper grouping

### 3. Updated Functions

#### `initialize()`
Now creates:
- Collection mint account
- Collection metadata with Metaplex standard
- Collection master edition
- Collection details (size tracking)

**New Parameters:**
- `collection_name`: String - Name of your collection (e.g., "Fight Tickets")
- `collection_symbol`: String - Symbol (e.g., "FIGHT")

**New Accounts Required:**
- `collection_mint`: The SPL token mint for the collection
- `collection_token_account`: Associated token account (must be created before calling)
- `collection_metadata`: PDA for Metaplex metadata
- `collection_master_edition`: PDA for master edition
- `token_metadata_program`: Metaplex Token Metadata program ID
- `sysvar_instructions`: Sysvar for instructions

#### `claim()`
Now creates:
- NFT mint account
- NFT token account (one token minted to recipient)
- NFT metadata with name, symbol, URI, and collection reference
- NFT master edition (supply = 0, making it unique)

**New Parameters:**
- `name`: String - Individual NFT name (e.g., "Fight Ticket #69")
- `uri`: String - Metadata JSON URI (should point to your JSON metadata)

**New Accounts Required:**
- `nft_mint`: The SPL token mint for the NFT
- `nft_token_account`: Associated token account (must be created before calling)
- `nft_metadata`: PDA for NFT Metaplex metadata
- `nft_master_edition`: PDA for NFT master edition
- `recipient_account`: The wallet receiving the NFT
- `token_metadata_program`: Metaplex Token Metadata program ID
- `sysvar_instructions`: Sysvar for instructions

## Client-Side Changes Needed

### 1. Create Associated Token Accounts First

Before calling `initialize()` or `claim()`, you need to create the associated token accounts:

```typescript
import { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

// For collection
const collectionTokenAccount = await getAssociatedTokenAddress(
  collectionMint,
  authority.publicKey
);

// For NFT
const nftTokenAccount = await getAssociatedTokenAddress(
  nftMint,
  recipient
);

// Add instruction to create if it doesn't exist
const createAtaIx = createAssociatedTokenAccountInstruction(
  payer.publicKey,
  nftTokenAccount,
  recipient,
  nftMint
);
```

### 2. Calculate Metadata PDAs

```typescript
import { PublicKey } from '@solana/web3.js';

const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

function getMetadataPDA(mint: PublicKey): PublicKey {
  const [metadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return metadata;
}

function getMasterEditionPDA(mint: PublicKey): PublicKey {
  const [edition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  return edition;
}
```

### 3. Update Initialize Call

```typescript
const collectionMint = Keypair.generate();
const collectionMetadata = getMetadataPDA(collectionMint.publicKey);
const collectionMasterEdition = getMasterEditionPDA(collectionMint.publicKey);
const collectionTokenAccount = await getAssociatedTokenAddress(
  collectionMint.publicKey,
  authority.publicKey
);

await program.methods
  .initialize(
    signerPublicKey,
    baseUri,
    "Fight Tickets", // collection name
    "FIGHT"          // collection symbol
  )
  .accounts({
    collection: collectionPDA,
    collectionMint: collectionMint.publicKey,
    collectionTokenAccount,
    collectionMetadata,
    collectionMasterEdition,
    authority: authority.publicKey,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
  })
  .signers([authority, collectionMint])
  .rpc();
```

### 4. Update Claim Call

```typescript
const nftMint = Keypair.generate();
const nftMetadata = getMetadataPDA(nftMint.publicKey);
const nftMasterEdition = getMasterEditionPDA(nftMint.publicKey);
const nftTokenAccount = await getAssociatedTokenAddress(
  nftMint.publicKey,
  recipient
);

// Create ATA instruction
const createAtaIx = createAssociatedTokenAccountInstruction(
  payer.publicKey,
  nftTokenAccount,
  recipient,
  nftMint.publicKey
);

// Create claim instruction
const claimIx = await program.methods
  .claim(
    proof,
    nftId,
    recipient,
    "Fight Ticket #" + nftId,  // name
    `${baseUri}${nftId}.json`  // uri
  )
  .accounts({
    collection: collectionPDA,
    nft: nftPDA,
    nftMint: nftMint.publicKey,
    nftTokenAccount,
    nftMetadata,
    nftMasterEdition,
    recipientAccount: recipient,
    payer: payer.publicKey,
    instructionSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    rent: SYSVAR_RENT_PUBKEY,
    tokenMetadataProgram: TOKEN_METADATA_PROGRAM_ID,
    sysvarInstructions: SYSVAR_INSTRUCTIONS_PUBKEY,
  })
  .instruction();

// Combine with ed25519 verification
const tx = new Transaction()
  .add(ed25519Ix)
  .add(createAtaIx)
  .add(claimIx);
```

## Metadata JSON Format

Your metadata JSON files should follow the Metaplex standard:

```json
{
  "name": "Fight Ticket #69",
  "symbol": "FIGHT",
  "description": "VIP access ticket to Fight Foundation event",
  "seller_fee_basis_points": 0,
  "image": "https://ticketsnft.fight.foundation/images/69.png",
  "attributes": [
    {
      "trait_type": "Event",
      "value": "Main Event"
    },
    {
      "trait_type": "Tier",
      "value": "VIP"
    },
    {
      "trait_type": "Ticket ID",
      "value": "69"
    }
  ],
  "properties": {
    "files": [
      {
        "uri": "https://ticketsnft.fight.foundation/images/69.png",
        "type": "image/png"
      }
    ],
    "category": "image",
    "creators": [
      {
        "address": "YOUR_AUTHORITY_ADDRESS",
        "share": 100
      }
    ]
  }
}
```

## Benefits

1. **Block Explorer Support**: NFTs show up properly in Solscan, Solana FM with images and metadata
2. **Wallet Support**: Phantom, Solflare, and other wallets display NFTs correctly
3. **Marketplace Ready**: Compatible with Magic Eden, Tensor, and other marketplaces
4. **Collection Grouping**: All NFTs are properly grouped under your collection
5. **Standard Compliance**: Follows Metaplex metadata standards

## Testing

After deploying, you can verify your NFTs on:
- Solscan: `https://solscan.io/token/<mint-address>?cluster=devnet`
- Solana FM: `https://solana.fm/address/<mint-address>?cluster=devnet-solana`

Your NFTs should now display with proper images, names, and descriptions!
