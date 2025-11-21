#!/usr/bin/env node
// Inspect a claimed NFT account and decode fields.
// Usage: node scripts/inspect-nft.cjs <nftId>

const anchor = require('@coral-xyz/anchor');
const { PublicKey } = require('@solana/web3.js');
const fs = require('fs');

async function main() {
  const nftIdArg = process.argv[2];
  if (!nftIdArg) {
    console.error('Usage: node scripts/inspect-nft.cjs <nftId>');
    process.exit(1);
  }
  const nftId = parseInt(nftIdArg, 10);
  if (isNaN(nftId)) throw new Error('Invalid nftId');

  const programId = new PublicKey(process.env.NFT_CONTRACT_ADDRESS || '6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG');
  const collectionAddress = process.env.NFT_COLLECTION_ADDRESS;
  if (!collectionAddress) throw new Error('NFT_COLLECTION_ADDRESS env not set');
  const collectionPubkey = new PublicKey(collectionAddress);

  const connection = new anchor.web3.Connection(process.env.ANCHOR_PROVIDER_URL || 'https://api.devnet.solana.com', 'confirmed');

  // Derive PDA
  const nftIdLe = Buffer.alloc(4); nftIdLe.writeUInt32LE(nftId,0);
  const [nftPda] = PublicKey.findProgramAddressSync([
    Buffer.from('nft'),
    collectionPubkey.toBuffer(),
    nftIdLe,
  ], programId);

  console.log('NFT PDA:', nftPda.toString());

  const info = await connection.getAccountInfo(nftPda);
  if (!info) {
    console.log('No account found for this NFT ID');
    return;
  }
  console.log('Raw length:', info.data.length);

  // Layout:
  // 0..8 discriminator
  // 8..12 nft_id (u32 LE)
  // 12..44 owner pubkey (32)
  // 44..76 collection pubkey (32)
  const data = info.data;
  const nftIdDecoded = data.readUInt32LE(8);
  const ownerPubkey = new PublicKey(data.slice(12, 44));
  const collectionDecoded = new PublicKey(data.slice(44, 76));

  console.log({
    nftIdDecoded,
    owner: ownerPubkey.toString(),
    collection: collectionDecoded.toString(),
    lamports: info.lamports,
    executable: info.executable,
  });
}

main().catch(e => { console.error(e); process.exit(1); });
