#!/usr/bin/env node
// Initialize NFT collection on mainnet

const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

async function main() {
  // Configuration
  const programId = new PublicKey('6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG');
  const apiSignerPubkey = new PublicKey('HQ2FdnP3RgZtPpqJgik2VKoa9x3hJWEFpfFg774uUAQc');
  
  const baseUri = 'https://ticketsnft.fight.foundation/metadata/';
  const collectionName = 'Fight Tickets';
  const collectionSymbol = 'FIGHT';

  // Load authority keypair (deployer)
  const authoritySecret = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET || '/home/alex/solana-key-loader/keypair.json', 'utf8'));
  const authorityKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(authoritySecret));

  // Load collection keypair
  const collectionSecret = JSON.parse(fs.readFileSync('./collection-mainnet-keypair.json', 'utf8'));
  const collectionKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(collectionSecret));

  // Generate a new keypair for the collection mint (required for init constraint)
  const collectionMintKeypair = anchor.web3.Keypair.generate();

  // Setup connection and provider
  const connection = new anchor.web3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const wallet = new anchor.Wallet(authorityKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  console.log('\n🚀 Initializing Fight Tickets NFT Collection on Mainnet');
  console.log('=========================================================\n');
  console.log('Program ID:', programId.toString());
  console.log('Authority:', authorityKeypair.publicKey.toString());
  console.log('Collection:', collectionKeypair.publicKey.toString());
  console.log('Collection Mint:', collectionMintKeypair.publicKey.toString());
  console.log('API Signer:', apiSignerPubkey.toString());
  console.log('Base URI:', baseUri);
  console.log('\nCollection Details:');
  console.log('  Name:', collectionName);
  console.log('  Symbol:', collectionSymbol);

  // Derive Metaplex metadata PDAs
  const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');
  
  const [collectionMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      collectionMintKeypair.publicKey.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      collectionMintKeypair.publicKey.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  // Derive collection token account
  const [collectionTokenAccount] = PublicKey.findProgramAddressSync(
    [
      authorityKeypair.publicKey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      collectionMintKeypair.publicKey.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  console.log('\nDerived Addresses:');
  console.log('  Metadata:', collectionMetadata.toString());
  console.log('  Master Edition:', collectionMasterEdition.toString());
  console.log('  Token Account:', collectionTokenAccount.toString());

  // Build initialize instruction manually
  const INITIALIZE_DISCRIMINATOR = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);
  
  function serializeString(str) {
    const encoded = Buffer.from(str, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32LE(encoded.length, 0);
    return Buffer.concat([length, encoded]);
  }

  const signerBytes = apiSignerPubkey.toBuffer();
  const baseUriBytes = serializeString(baseUri);
  const nameBytes = serializeString(collectionName);
  const symbolBytes = serializeString(collectionSymbol);

  const data = Buffer.concat([
    INITIALIZE_DISCRIMINATOR,
    signerBytes,
    baseUriBytes,
    nameBytes,
    symbolBytes,
  ]);

  const RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');
  const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey('Sysvar1nstructions1111111111111111111111111');

  const initIx = new anchor.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: collectionKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: collectionMintKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: collectionTokenAccount, isSigner: false, isWritable: true },
      { pubkey: collectionMetadata, isSigner: false, isWritable: true },
      { pubkey: collectionMasterEdition, isSigner: false, isWritable: true },
      { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  console.log('\n📤 Sending transaction...');
  
  const tx = new anchor.web3.Transaction().add(initIx);
  const txSig = await provider.sendAndConfirm(tx, [authorityKeypair, collectionKeypair, collectionMintKeypair], {
    skipPreflight: false,
    commitment: 'confirmed',
  });

  console.log('\n✅ Collection initialized successfully!');
  console.log('Transaction:', txSig);
  console.log('Explorer:', `https://solscan.io/tx/${txSig}`);
  console.log('\n📋 Save these addresses:');
  console.log('  Collection:', collectionKeypair.publicKey.toString());
  console.log('  Collection Mint:', collectionMintKeypair.publicKey.toString());
  console.log('  API Signer:', apiSignerPubkey.toString());
}

main().catch(e => {
  console.error('\n❌ Error initializing collection:', e);
  if (e.logs) {
    console.error('\nProgram logs:');
    e.logs.forEach(log => console.error('  ', log));
  }
  process.exit(1);
});
