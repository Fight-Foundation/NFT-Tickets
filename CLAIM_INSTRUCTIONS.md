# How to Claim Your Fight Ticket NFT

This guide explains how to claim your Fight Ticket NFT on Solana mainnet using the claim proof from the API.

## Prerequisites

- Node.js installed
- Solana CLI tools installed
- A Solana wallet with some SOL for transaction fees (~0.01-0.02 SOL)
- Your claim proof from the API

## Step 1: Get Your Claim Proof

Request your claim proof from the API:

```bash
curl -X POST https://ticketsnft.fight.foundation/api/claim/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "walletAddress": "YOUR_WALLET_ADDRESS",
    "nftId": YOUR_NFT_ID,
    "metadata": {
      "name": "Fight Ticket #YOUR_NFT_ID",
      "description": "Your ticket description",
      "image": "https://ticketsnft.fight.foundation/images/ticket.png",
      "attributes": [
        {"trait_type": "Event", "value": "Event Name"},
        {"trait_type": "Tier", "value": "General Admission"}
      ]
    }
  }'
```

Response:
```json
{
  "nftId": 1,
  "walletAddress": "YOUR_WALLET_ADDRESS",
  "signature": "0a4d9d9e6fa893e3ebece482abc378f7ce0d3f78...",
  "signerPublicKey": "HQ2FdnP3RgZtPpqJgik2VKoa9x3hJWEFpfFg774uUAQc",
  "claimId": 123,
  "message": "Claim proof generated successfully"
}
```

**Save the `signature` value** - you'll need it for the next step.

## Step 2: Install Dependencies

```bash
npm install @coral-xyz/anchor @solana/web3.js @solana/spl-token
```

## Step 3: Create Claim Script

Save this as `claim-my-nft.js`:

```javascript
#!/usr/bin/env node
const anchor = require('@coral-xyz/anchor');
const { PublicKey, SystemProgram } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const fs = require('fs');

async function main() {
  // ===== CONFIGURATION - UPDATE THESE VALUES =====
  const PROGRAM_ID = '6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG';
  const COLLECTION_ADDRESS = '2KnpADRtu1mwoaxejikvZSUDzWNXPHaHFDrQckNAECiZ';
  const RPC_URL = 'https://api.mainnet-beta.solana.com'; // or your preferred RPC
  
  // Your claim details from the API response
  const NFT_ID = 1; // YOUR NFT ID
  const RECIPIENT = 'YOUR_WALLET_ADDRESS'; // Your wallet address
  const SIGNATURE = '0a4d9d9e6fa893e3ebece482abc378f7ce0d3f78...'; // From API response
  const NFT_NAME = 'Fight Ticket #1';
  const NFT_URI = 'https://ticketsnft.fight.foundation/metadata/1.json';
  
  // Path to your wallet keypair file
  const WALLET_PATH = process.env.HOME + '/.config/solana/id.json';
  // ===============================================

  console.log('\n🎫 Claiming Fight Ticket NFT');
  console.log('==============================\n');
  console.log('NFT ID:', NFT_ID);
  console.log('Recipient:', RECIPIENT);
  console.log('Program:', PROGRAM_ID);

  // Load your wallet
  const walletKeypair = anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(WALLET_PATH, 'utf8')))
  );

  // Setup connection
  const connection = new anchor.web3.Connection(RPC_URL, 'confirmed');
  const wallet = new anchor.Wallet(walletKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  const programId = new PublicKey(PROGRAM_ID);
  const collectionPubkey = new PublicKey(COLLECTION_ADDRESS);
  const recipientPubkey = new PublicKey(RECIPIENT);

  // Derive PDAs
  const [nftPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('nft'),
      collectionPubkey.toBuffer(),
      Buffer.from(new Uint8Array(new Uint32Array([NFT_ID]).buffer)),
    ],
    programId
  );

  const [nftMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('nft_mint'), nftPda.toBuffer()],
    programId
  );

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

  const [recipientTokenAccount] = PublicKey.findProgramAddressSync(
    [
      recipientPubkey.toBuffer(),
      TOKEN_PROGRAM_ID.toBuffer(),
      nftMint.toBuffer(),
    ],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const [collectionMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection_mint'), collectionPubkey.toBuffer()],
    programId
  );

  const [collectionMetadata] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      collectionMint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  const [collectionMasterEdition] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('metadata'),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      collectionMint.toBuffer(),
      Buffer.from('edition'),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );

  console.log('\n📋 Derived Accounts:');
  console.log('NFT PDA:', nftPda.toString());
  console.log('NFT Mint:', nftMint.toString());
  console.log('Token Account:', recipientTokenAccount.toString());

  // Build claim instruction
  const CLAIM_DISCRIMINATOR = Buffer.from([62, 198, 214, 193, 213, 159, 108, 210]);

  // Convert signature from hex to bytes
  const signatureBytes = Buffer.from(SIGNATURE, 'hex');
  if (signatureBytes.length !== 64) {
    throw new Error('Signature must be 64 bytes (128 hex characters)');
  }

  function serializeString(str) {
    const encoded = Buffer.from(str, 'utf8');
    const length = Buffer.alloc(4);
    length.writeUInt32LE(encoded.length, 0);
    return Buffer.concat([length, encoded]);
  }

  const nftIdBuffer = Buffer.alloc(4);
  nftIdBuffer.writeUInt32LE(NFT_ID, 0);

  const recipientBytes = recipientPubkey.toBuffer();
  const nameBytes = serializeString(NFT_NAME);
  const uriBytes = serializeString(NFT_URI);

  const data = Buffer.concat([
    CLAIM_DISCRIMINATOR,
    signatureBytes,
    nftIdBuffer,
    recipientBytes,
    nameBytes,
    uriBytes,
  ]);

  const SYSVAR_INSTRUCTIONS_PUBKEY = new PublicKey('Sysvar1nstructions1111111111111111111111111');
  const RENT_PUBKEY = new PublicKey('SysvarRent111111111111111111111111111111111');

  const claimIx = new anchor.web3.TransactionInstruction({
    programId,
    keys: [
      { pubkey: collectionPubkey, isSigner: false, isWritable: true },
      { pubkey: nftPda, isSigner: false, isWritable: true },
      { pubkey: nftMint, isSigner: false, isWritable: true },
      { pubkey: recipientTokenAccount, isSigner: false, isWritable: true },
      { pubkey: nftMetadata, isSigner: false, isWritable: true },
      { pubkey: nftMasterEdition, isSigner: false, isWritable: true },
      { pubkey: collectionMint, isSigner: false, isWritable: true },
      { pubkey: collectionMetadata, isSigner: false, isWritable: true },
      { pubkey: collectionMasterEdition, isSigner: false, isWritable: false },
      { pubkey: walletKeypair.publicKey, isSigner: true, isWritable: true },
      { pubkey: recipientPubkey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: TOKEN_METADATA_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  console.log('\n📤 Submitting claim transaction...');

  const tx = new anchor.web3.Transaction().add(claimIx);
  const txSig = await provider.sendAndConfirm(tx, [walletKeypair], {
    skipPreflight: false,
    commitment: 'confirmed',
  });

  console.log('\n✅ NFT Claimed Successfully!');
  console.log('Transaction:', txSig);
  console.log('Explorer:', `https://solscan.io/tx/${txSig}`);
  console.log('\n🎉 Your NFT is now in your wallet!');
  console.log('View on:', `https://solscan.io/account/${recipientTokenAccount.toString()}`);
}

main().catch(e => {
  console.error('\n❌ Error claiming NFT:', e);
  if (e.logs) {
    console.error('\nProgram logs:');
    e.logs.forEach(log => console.error('  ', log));
  }
  process.exit(1);
});
```

## Step 4: Update the Configuration

Edit the `claim-my-nft.js` file and update these values:

```javascript
const NFT_ID = 1; // Your NFT ID from the API
const RECIPIENT = 'YOUR_WALLET_ADDRESS'; // Your Solana wallet address
const SIGNATURE = '0a4d9d9e6fa893e3...'; // Full signature from API response
const NFT_NAME = 'Fight Ticket #1'; // Your NFT name
const NFT_URI = 'https://ticketsnft.fight.foundation/metadata/1.json'; // Your metadata URL
```

**Important:** The `NFT_URI` should match the pattern: `https://ticketsnft.fight.foundation/metadata/{NFT_ID}.json`

## Step 5: Run the Claim Script

```bash
node claim-my-nft.js
```

Expected output:
```
🎫 Claiming Fight Ticket NFT
==============================

NFT ID: 1
Recipient: YOUR_WALLET_ADDRESS
Program: 6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG

📋 Derived Accounts:
NFT PDA: ASxbcQzYUWC2GX3S1mvzwBQ77jifgfeteADR7FswvusP
NFT Mint: 8rYvZ7L5xvRiGJ9eDvnhg2WpKfNpQ2GkM3Bz1V4nV7Fs
Token Account: 9hdBeoht1cdZzWwzqvyVr1RRA3xP7DPRszQmBayQWAWL

📤 Submitting claim transaction...

✅ NFT Claimed Successfully!
Transaction: 4wo8zzrZLRXtLtEC5Z4kPKpzMWXiCx78hn4FgLTLZFhE...
Explorer: https://solscan.io/tx/4wo8zzrZLRXtLtEC5Z4kPKpzMWXiCx78hn4FgLTLZFhE...

🎉 Your NFT is now in your wallet!
```

## Step 6: View Your NFT

After claiming, you can view your NFT:

1. **On Solscan:** https://solscan.io/account/{YOUR_WALLET_ADDRESS}
2. **In Phantom Wallet:** Open Phantom and check your Collectibles tab
3. **On Magic Eden:** Your NFT will appear in your profile
4. **Metadata:** https://ticketsnft.fight.foundation/metadata/{NFT_ID}.json

## Troubleshooting

### Error: "Invalid proof signature"
- Make sure you copied the complete signature from the API response
- Verify you're using the correct wallet address that matches the proof
- Ensure the NFT ID matches the one in your proof

### Error: "NFT already claimed"
- This NFT has already been minted
- Check if it's already in your wallet
- Request a different NFT ID from the organizer

### Error: "Insufficient funds"
- You need ~0.01-0.02 SOL for transaction fees
- Add SOL to your wallet and try again

### Error: "Invalid wallet keypair"
- Check that your wallet path is correct
- Default path: `~/.config/solana/id.json`
- Or set custom path: `const WALLET_PATH = '/path/to/your/keypair.json'`

## Using a Different RPC

For faster transactions, use a premium RPC:

```javascript
// Helius (requires API key)
const RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=YOUR_KEY';

// Alchemy (requires API key)
const RPC_URL = 'https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY';

// QuickNode (requires endpoint)
const RPC_URL = 'https://your-endpoint.solana-mainnet.quiknode.pro/YOUR_KEY/';
```

## Security Notes

- **Never share your wallet private key**
- Keep your API key secure
- Only run claim scripts you trust
- Verify the program ID matches: `6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG`
- Verify the collection address matches: `2KnpADRtu1mwoaxejikvZSUDzWNXPHaHFDrQckNAECiZ`

## Need Help?

Contact the Fight Foundation team or check the documentation at:
- Website: https://fight.foundation
- GitHub: https://github.com/Fight-Foundation/NFT-Tickets
