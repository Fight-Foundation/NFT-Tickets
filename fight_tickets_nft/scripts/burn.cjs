#!/usr/bin/env node
// Burn an NFT (operator only)

const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');

async function main() {
  const nftId = parseInt(process.argv[2]) || 3;
  
  // Configuration
  const programId = new PublicKey('6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG');
  
  // Load collection keypair
  const collectionSecret = JSON.parse(fs.readFileSync('./collection-keypair.json', 'utf8'));
  const collectionKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(collectionSecret));

  // Load authority keypair (operator)
  const authoritySecret = JSON.parse(fs.readFileSync(process.env.ANCHOR_WALLET || '/home/alex/solana-key-loader/keypair.json', 'utf8'));
  const authorityKeypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array(authoritySecret));

  // Setup connection and provider
  const connection = new anchor.web3.Connection(
    process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    'confirmed'
  );
  const wallet = new anchor.Wallet(authorityKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  console.log('\n🔥 Burning NFT from Collection');
  console.log('================================\n');
  console.log('Program ID:', programId.toString());
  console.log('Collection:', collectionKeypair.publicKey.toString());
  console.log('Authority:', authorityKeypair.publicKey.toString());
  console.log('NFT ID:', nftId);

  // Derive NFT PDA
  const [nftPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('nft'),
      collectionKeypair.publicKey.toBuffer(),
      Buffer.from(new Uint8Array(new Uint32Array([nftId]).buffer)),
    ],
    programId
  );

  console.log('NFT PDA:', nftPda.toString());

  // Build burn instruction discriminator
  const BURN_DISCRIMINATOR = Buffer.from([116, 110, 29, 56, 107, 219, 42, 93]);
  
  // Encode nft_id as u32 little-endian
  const nftIdBuffer = Buffer.alloc(4);
  nftIdBuffer.writeUInt32LE(nftId, 0);
  
  const data = Buffer.concat([BURN_DISCRIMINATOR, nftIdBuffer]);

  const burnIx = new anchor.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: collectionKeypair.publicKey, isSigner: false, isWritable: true },
      { pubkey: nftPda, isSigner: false, isWritable: true },
      { pubkey: authorityKeypair.publicKey, isSigner: true, isWritable: false },
      { pubkey: authorityKeypair.publicKey, isSigner: false, isWritable: true }, // recipient of lamports
    ],
    data,
  });

  console.log('\n📤 Sending burn transaction...');
  
  const tx = new anchor.web3.Transaction().add(burnIx);
  const txSig = await provider.sendAndConfirm(tx, [authorityKeypair], {
    skipPreflight: false,
    commitment: 'confirmed',
  });

  console.log('\n✅ NFT burned successfully!');
  console.log('Transaction:', txSig);
  console.log('Explorer:', `https://solscan.io/tx/${txSig}?cluster=devnet`);
}

main().catch(e => {
  console.error('\n❌ Error burning NFT:', e);
  if (e.logs) {
    console.error('\nProgram logs:');
    e.logs.forEach(log => console.error('  ', log));
  }
  process.exit(1);
});
