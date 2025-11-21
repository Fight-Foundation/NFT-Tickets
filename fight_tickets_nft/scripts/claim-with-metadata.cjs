#!/usr/bin/env node
// Submit on-chain claim for an NFT with metadata using generated signature proof.
// Usage: node scripts/claim-with-metadata.cjs <nftId> <recipientPubkey> <signatureHex> <name> <uri>

const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram, TransactionInstruction, Transaction } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const crypto = require('crypto');
const fs = require('fs');

async function main() {
  const [,, nftIdArg, recipientArg, signatureHex, name, uri] = process.argv;
  if (!nftIdArg || !recipientArg || !signatureHex || !name || !uri) {
    console.error('Usage: node scripts/claim-with-metadata.cjs <nftId> <recipientPubkey> <signatureHex> <name> <uri>');
    process.exit(1);
  }

  const nftId = parseInt(nftIdArg, 10);
  if (isNaN(nftId)) {
    throw new Error('Invalid nftId');
  }

  if (signatureHex.length !== 128) {
    throw new Error('Signature hex must be 128 characters (64 bytes)');
  }

  const recipientPubkey = new PublicKey(recipientArg);
  const signatureBuf = Buffer.from(signatureHex, 'hex');

  // Environment / config
  const programId = new PublicKey(process.env.NFT_CONTRACT_ADDRESS || '6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG');
  const collectionAddress = process.env.NFT_COLLECTION_ADDRESS;
  if (!collectionAddress) throw new Error('NFT_COLLECTION_ADDRESS env not set');
  const collectionPubkey = new PublicKey(collectionAddress);
  const signerPubkey = new PublicKey(process.env.SIGNING_PUBLIC_KEY || 'HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft');

  // Load payer keypair (test-user.json relative to this dir)
  const payerSecretPath = process.env.ANCHOR_WALLET || '../test-user.json';
  const payerSecret = JSON.parse(fs.readFileSync(payerSecretPath, 'utf8'));
  const payerKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(payerSecret));

  // Setup provider with payer as wallet
  const connection = new anchor.web3.Connection(process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com', 'confirmed');
  const wallet = new anchor.Wallet(payerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  console.log('➡️  Submitting claim with metadata');
  console.log('Program:', programId.toString());
  console.log('Collection:', collectionPubkey.toString());
  console.log('Recipient:', recipientPubkey.toString());
  console.log('Signer Pubkey:', signerPubkey.toString());
  console.log('NFT ID:', nftId);
  console.log('Name:', name);
  console.log('URI:', uri);

  // Construct message hash (recipient pubkey + nftId LE) same as generation
  const nftIdBytes = Buffer.alloc(4);
  nftIdBytes.writeUInt32LE(nftId, 0);
  const message = Buffer.concat([recipientPubkey.toBuffer(), nftIdBytes]);
  const messageHash = crypto.createHash('sha256').update(message).digest();

  // Ed25519 verification instruction (signature over messageHash)
  function createEd25519Instruction(signature, publicKey, messageHashBuffer) {
    const ED25519_PROGRAM_ID = new PublicKey('Ed25519SigVerify111111111111111111111111111');
    const numSignatures = 1;
    const padding = 0;
    const signatureOffset = 16; // After header
    const signatureInstructionIndex = 0xffff; // Current instruction
    const publicKeyOffset = signatureOffset + 64;
    const publicKeyInstructionIndex = 0xffff;
    const messageDataOffset = publicKeyOffset + 32;
    const messageDataSize = messageHashBuffer.length;
    const messageInstructionIndex = 0xffff;

    const data = Buffer.alloc(16 + 64 + 32 + messageHashBuffer.length);
    // Header
    data.writeUInt8(numSignatures, 0);
    data.writeUInt8(padding, 1);
    data.writeUInt16LE(signatureOffset, 2);
    data.writeUInt16LE(signatureInstructionIndex, 4);
    data.writeUInt16LE(publicKeyOffset, 6);
    data.writeUInt16LE(publicKeyInstructionIndex, 8);
    data.writeUInt16LE(messageDataOffset, 10);
    data.writeUInt16LE(messageDataSize, 12);
    data.writeUInt16LE(messageInstructionIndex, 14);
    // Signature
    signature.copy(data, signatureOffset);
    // Public key
    publicKey.toBuffer().copy(data, publicKeyOffset);
    // Message (hash)
    messageHashBuffer.copy(data, messageDataOffset);

    return new TransactionInstruction({
      programId: ED25519_PROGRAM_ID,
      keys: [],
      data,
    });
  }

  const ed25519Ix = createEd25519Instruction(signatureBuf, signerPubkey, messageHash);

  // Derive NFT PDA
  const [nftPda] = PublicKey.findProgramAddressSync([
    Buffer.from('nft'),
    collectionPubkey.toBuffer(),
    nftIdBytes,
  ], programId);
  console.log('NFT PDA:', nftPda.toString());

  // Generate a new keypair for nft_mint (it needs to be a signer)
  const nftMintKeypair = anchor.web3.Keypair.generate();
  const nftMint = nftMintKeypair.publicKey;
  console.log('NFT Mint:', nftMint.toString());

  // Get collection data to find collection mint
  const collectionAccountInfo = await connection.getAccountInfo(collectionPubkey);
  if (!collectionAccountInfo) {
    throw new Error('Collection account not found');
  }
  const collectionMint = new PublicKey(collectionAccountInfo.data.slice(8, 40));
  console.log('Collection Mint:', collectionMint.toString());

  // Derive Metaplex PDAs
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  
  const [nftMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
  
  const [nftMasterEdition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Derive ATA for recipient
  const recipientAta = PublicKey.findProgramAddressSync(
    [
      recipientPubkey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )[0];

  console.log('NFT Metadata:', nftMetadata.toString());
  console.log('NFT Master Edition:', nftMasterEdition.toString());
  console.log('Recipient ATA:', recipientAta.toString());

  // Build claim instruction manually
  const CLAIM_DISCRIMINATOR = Buffer.from([62,198,214,193,213,159,108,210]);
  
  // Serialize the instruction data
  function serializeString(str) {
    const encoded = Buffer.from(str, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32LE(encoded.length, 0);
    return Buffer.concat([length, encoded]);
  }
  
  const proofBytes = signatureBuf; // 64 bytes
  const nftIdLe = Buffer.alloc(4); 
  nftIdLe.writeUInt32LE(nftId, 0);
  const recipientBytes = recipientPubkey.toBuffer();
  const nameBytes = serializeString(name);
  const uriBytes = serializeString(uri);
  
  const data = Buffer.concat([
    CLAIM_DISCRIMINATOR,
    proofBytes,
    nftIdLe,
    recipientBytes,
    nameBytes,
    uriBytes,
  ]);

  // The claim instruction needs all these accounts (matching IDL order)
  const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey('Sysvar1nstructions1111111111111111111111111');
  const RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

  const claimIx = new TransactionInstruction({
    programId,
    keys: [
      { pubkey: collectionPubkey, isSigner: false, isWritable: true },
      { pubkey: nftPda, isSigner: false, isWritable: true },
      { pubkey: nftMintKeypair.publicKey, isSigner: true, isWritable: true },  // nft_mint must be signer
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: nftMetadata, isSigner: false, isWritable: true },
      { pubkey: nftMasterEdition, isSigner: false, isWritable: true },
      { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      { pubkey: payerKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },  // sysvar_instructions (duplicate)
    ],
    data,
  });

  const tx = new anchor.web3.Transaction().add(ed25519Ix, claimIx);
  
  console.log('\n🚀 Sending transaction...');
  const txSig = await provider.sendAndConfirm(tx, [payerKeypair, nftMintKeypair], {
    skipPreflight: false,
    commitment: 'confirmed',
  });
  console.log('✅ Claim transaction submitted:', txSig);

  // Wait a bit and fetch NFT account
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  try {
    const acctInfo = await connection.getAccountInfo(nftPda);
    if (acctInfo) {
      console.log('\n✅ NFT account created');
      console.log('   Data length:', acctInfo.data.length);
      console.log('   Lamports:', acctInfo.lamports);
    } else {
      console.log('\n⚠️  NFT account not found yet.');
    }
  } catch (e) {
    console.warn('Fetch NFT account failed:', e.message);
  }
}

main().catch(e => {
  console.error('❌ Error submitting claim:', e);
  if (e.logs) {
    console.error('\n📋 Program logs:');
    e.logs.forEach(log => console.error('  ', log));
  }
  process.exit(1);
});
