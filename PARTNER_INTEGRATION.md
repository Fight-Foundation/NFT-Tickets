# Partner Integration Guide

This guide is for partners who want to integrate the Fight Tickets NFT claim system into their platform. Partners will generate claim proofs via the API and guide users to claim their NFTs on-chain.

## Overview

The claim flow involves two main steps:

1. **Partner Backend**: Generate a cryptographic claim proof via API
2. **User Frontend**: Submit the proof on-chain to claim the NFT

```
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│   Partner    │─────>│  Claim API   │      │   Solana     │
│   Backend    │      │   (yours)    │      │  Blockchain  │
└──────────────┘      └──────────────┘      └──────────────┘
       │                      │                      ▲
       │                      │                      │
       │  1. Generate proof   │                      │
       │◄─────────────────────┤                      │
       │                      │                      │
       │  2. Pass to user     │                      │
       ▼                      │                      │
┌──────────────┐              │                      │
│     User     │              │                      │
│   Wallet     │──────────────┼─────────────────────>│
│  (Frontend)  │              │   3. Claim NFT       │
└──────────────┘              │                      │
```

---

## Part 1: Backend Integration (Partner)

### Prerequisites

- API key (contact us to obtain)
- HTTPS endpoint for API calls
- Ability to store/pass data to your frontend

### 1.1 Generate Claim Proof

Call the API to generate a claim proof for a user:

**Endpoint:** `POST /api/claim/generate`

**Request:**
```typescript
interface ClaimRequest {
  walletAddress: string;  // User's Solana wallet address
  nftId: number;          // NFT ID (0-9999)
  metadata: {             // NFT metadata (OpenSea standard)
    name: string;
    description: string;
    image: string;
    attributes?: Array<{
      trait_type: string;
      value: string | number;
    }>;
  };
}
```

**Example:**
```typescript
const response = await fetch('https://api.yoursite.com/api/claim/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': process.env.YOUR_API_KEY
  },
  body: JSON.stringify({
    walletAddress: userWalletAddress,
    nftId: 42,
    metadata: {
      name: 'Fight Championship Ticket #42',
      description: 'VIP access to the championship fight',
      image: 'https://yourdomain.com/nft-images/42.png',
      attributes: [
        { trait_type: 'Event', value: 'Championship 2025' },
        { trait_type: 'Seat', value: 'Ringside A12' },
        { trait_type: 'Access Level', value: 'VIP' },
        { trait_type: 'Date', value: 'December 15, 2025' }
      ]
    }
  })
});

const claimData = await response.json();
```

**Response:**
```typescript
interface ClaimResponse {
  nftId: number;
  walletAddress: string;
  signature: string;        // 128-char hex string (64 bytes)
  signerPublicKey: string;  // base58 encoded public key
  claimId: number;
  message: string;
}
```

### 1.2 Pass Data to Frontend

Send the claim data to your frontend so the user can claim on-chain:

```typescript
// Return to your frontend
res.json({
  claimProof: {
    nftId: claimData.nftId,
    signature: claimData.signature,
    signerPublicKey: claimData.signerPublicKey
  },
  metadata: {
    name: '...',
    image: '...',
    // ... other metadata
  }
});
```

---

## Part 2: Frontend Integration (User Facing)

### Prerequisites

- Solana wallet adapter (@solana/wallet-adapter-react)
- Anchor framework (@coral-xyz/anchor)
- Connection to Solana RPC

### 2.1 Install Dependencies

```bash
npm install @solana/web3.js @solana/wallet-adapter-react @coral-xyz/anchor
```

### 2.2 Implement Claim Transaction

The user's wallet needs to sign a transaction that includes:
1. Ed25519 signature verification instruction (provided by Solana)
2. Your NFT claim instruction

**Complete Example:**

```typescript
import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import { AnchorProvider, Program } from '@coral-xyz/anchor';
import { useAnchorWallet } from '@solana/wallet-adapter-react';

// Your program IDL and ID
import { FightTicketsNft } from './idl/fight_tickets_nft';
import idl from './idl/fight_tickets_nft.json';

const PROGRAM_ID = new PublicKey('YOUR_PROGRAM_ID');
const ED25519_PROGRAM_ID = new PublicKey('Ed25519SigVerify111111111111111111111111111');

interface ClaimProof {
  nftId: number;
  signature: string;
  signerPublicKey: string;
}

export async function claimNFT(
  claimProof: ClaimProof,
  userWallet: any,
  connection: Connection
) {
  // 1. Setup Anchor
  const provider = new AnchorProvider(connection, userWallet, {});
  const program = new Program<FightTicketsNft>(idl as any, PROGRAM_ID, provider);
  
  // 2. Convert signature from hex to bytes
  const signatureBytes = Buffer.from(claimProof.signature, 'hex');
  
  // 3. Reconstruct the message that was signed
  // Message = recipient_pubkey (32 bytes) + nft_id (4 bytes little-endian)
  const recipientPubkey = userWallet.publicKey.toBuffer();
  const nftIdBuffer = Buffer.alloc(4);
  nftIdBuffer.writeUInt32LE(claimProof.nftId, 0);
  const message = Buffer.concat([recipientPubkey, nftIdBuffer]);
  
  // 4. Hash the message (SHA-256)
  const crypto = require('crypto');
  const messageHash = crypto.createHash('sha256').update(message).digest();
  
  // 5. Create Ed25519 verification instruction
  const signerPubkey = new PublicKey(claimProof.signerPublicKey);
  
  const ed25519Instruction = new TransactionInstruction({
    keys: [],
    programId: ED25519_PROGRAM_ID,
    data: Buffer.concat([
      Buffer.from([1]), // Number of signatures
      Buffer.from([0]), // Padding
      Buffer.from([0, 0]), // Signature offset (u16 LE)
      Buffer.from([0]), // Signature instruction index
      Buffer.from([0, 0]), // Public key offset (u16 LE)
      Buffer.from([0]), // Public key instruction index
      Buffer.from([0, 0]), // Message data offset (u16 LE)
      Buffer.from([32, 0]), // Message data size (u16 LE) - 32 bytes
      Buffer.from([0]), // Message instruction index
      signerPubkey.toBuffer(), // 32 bytes - public key
      signatureBytes, // 64 bytes - signature
      messageHash // 32 bytes - message hash
    ])
  });
  
  // 6. Derive PDA accounts
  const [collectionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('collection')],
    program.programId
  );
  
  const [nftPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('nft'),
      collectionPda.toBuffer(),
      nftIdBuffer
    ],
    program.programId
  );
  
  // 7. Create claim instruction
  const claimIx = await program.methods
    .claim(
      Array.from(signatureBytes), // [u8; 64]
      claimProof.nftId
    )
    .accounts({
      collection: collectionPda,
      nft: nftPda,
      recipient: userWallet.publicKey,
      signer: signerPubkey,
      instructionsSysvar: new PublicKey('Sysvar1nstructions1111111111111111111111111'),
      systemProgram: new PublicKey('11111111111111111111111111111111'),
    })
    .instruction();
  
  // 8. Build and send transaction
  const transaction = new Transaction();
  transaction.add(ed25519Instruction);
  transaction.add(claimIx);
  
  // 9. Sign and send
  const signature = await provider.sendAndConfirm(transaction);
  
  console.log('NFT claimed! Signature:', signature);
  return signature;
}
```

### 2.3 React Component Example

```tsx
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useState } from 'react';

export function ClaimButton({ claimProof }: { claimProof: ClaimProof }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleClaim = async () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      setError('Please connect your wallet');
      return;
    }
    
    try {
      setClaiming(true);
      setError(null);
      
      const signature = await claimNFT(claimProof, wallet, connection);
      
      setClaimed(true);
      console.log('NFT claimed successfully!', signature);
      
      // Optional: Update your backend
      await fetch('/api/update-claim-status', {
        method: 'POST',
        body: JSON.stringify({ claimId: claimProof.claimId, signature })
      });
      
    } catch (err: any) {
      console.error('Claim failed:', err);
      setError(err.message || 'Failed to claim NFT');
    } finally {
      setClaiming(false);
    }
  };
  
  if (!wallet.connected) {
    return <WalletMultiButton />;
  }
  
  if (claimed) {
    return <div className="success">✅ NFT Claimed Successfully!</div>;
  }
  
  return (
    <div>
      <button 
        onClick={handleClaim} 
        disabled={claiming}
        className="claim-button"
      >
        {claiming ? 'Claiming...' : 'Claim NFT'}
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
```

---

## Part 3: Metadata Hosting

The NFT metadata is stored in the API database and served at:

```
GET https://api.yoursite.com/metadata/{nftId}.json
```

### 3.1 Update On-Chain URI

When initializing your NFT collection, set the `base_uri` to:

```rust
base_uri: "https://api.yoursite.com/metadata"
```

Then each NFT's metadata URI will be:
```
https://api.yoursite.com/metadata/0.json
https://api.yoursite.com/metadata/1.json
...
https://api.yoursite.com/metadata/9999.json
```

### 3.2 Metadata Response Format

The endpoint returns standard OpenSea-compatible metadata:

```json
{
  "name": "Fight Championship Ticket #42",
  "description": "VIP access to the championship fight",
  "image": "https://yourdomain.com/nft-images/42.png",
  "attributes": [
    { "trait_type": "Event", "value": "Championship 2025" },
    { "trait_type": "Seat", "value": "Ringside A12" },
    { "trait_type": "Access Level", "value": "VIP" }
  ]
}
```

### 3.3 Default Metadata

If no custom metadata was provided during claim generation, the API serves default metadata from environment variables:

```
DEFAULT_METADATA_NAME=Fight Ticket #{id}
DEFAULT_METADATA_DESCRIPTION=Soulbound NFT ticket for fight events
DEFAULT_METADATA_IMAGE=https://ticketsnft.fight.foundation/images/{id}.png
```

---

## Part 4: Testing

### 4.1 Test on Devnet

1. **Get Devnet SOL**: https://faucet.solana.com/
2. **Deploy program to Devnet**
3. **Test claim flow**:

```typescript
// Test wallet
const testWallet = 'HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft';

// Generate claim
const claim = await generateClaim(testWallet, 42);

// User claims on devnet
await claimNFT(claim, wallet, connection);
```

### 4.2 Verify Claim

Check if NFT was minted:

```typescript
const [nftPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('nft'), collectionPda.toBuffer(), nftIdBuffer],
  program.programId
);

const nftAccount = await program.account.nft.fetch(nftPda);
console.log('NFT Owner:', nftAccount.owner.toString());
console.log('NFT ID:', nftAccount.nftId);
```

---

## Part 5: Production Checklist

### Backend
- [ ] Secure API key storage
- [ ] Rate limiting on claim generation
- [ ] Validate user authentication before generating claims
- [ ] Log all claim generations
- [ ] Monitor for duplicate claims (same nftId)
- [ ] Set up proper error handling and alerts
- [ ] Use HTTPS only

### Frontend
- [ ] Implement proper wallet connection UI
- [ ] Show transaction confirmation to user
- [ ] Handle all error cases gracefully
- [ ] Display NFT metadata preview before claiming
- [ ] Add loading states
- [ ] Test on multiple wallets (Phantom, Solflare, etc.)
- [ ] Implement transaction retry logic

### Infrastructure
- [ ] Use Mainnet RPC (Alchemy, QuickNode, or Helius)
- [ ] Set up CDN for NFT images
- [ ] Implement database backups
- [ ] Set up monitoring and alerting
- [ ] Load test the claim flow
- [ ] Have rollback plan ready

---

## Part 6: Common Issues & Solutions

### Issue: "Invalid signature verification"
**Cause:** Message hash doesn't match or wrong signer public key  
**Solution:** Ensure message construction is exactly: `recipient_pubkey (32) + nft_id (4 LE)`

### Issue: "Signature verification must be in the same transaction"
**Cause:** Ed25519 instruction not in position 0  
**Solution:** Ed25519 instruction MUST be the first instruction in the transaction

### Issue: "Account already initialized"
**Cause:** NFT already claimed  
**Solution:** Check if NFT exists before claiming:

```typescript
try {
  const nftAccount = await program.account.nft.fetch(nftPda);
  if (nftAccount) {
    throw new Error('NFT already claimed');
  }
} catch (err) {
  // NFT doesn't exist, safe to claim
}
```

### Issue: "Metadata not loading"
**Cause:** Base URI not set correctly or API down  
**Solution:** Verify base_uri in collection account and test metadata endpoint

---

## Part 7: Support & Resources

### Documentation
- Smart Contract: `fight_tickets_nft/README.md`
- API Reference: `API_DOCUMENTATION.md`
- API Quick Start: `API_README.md`

### Example Code
- Full working example: `fight_tickets_nft/app/` (if available)
- Test suite: `fight_tickets_nft/tests/`
- API tests: `tests/api.test.ts`

### Contact
- GitHub Issues: https://github.com/Fight-Foundation/NFT-Tickets/issues
- Email: alex@ksso.net

### Useful Links
- Solana Docs: https://docs.solana.com
- Anchor Docs: https://www.anchor-lang.com
- Wallet Adapter: https://github.com/solana-labs/wallet-adapter
- OpenSea Metadata: https://docs.opensea.io/docs/metadata-standards

---

## Summary

**Partner (Backend):**
1. Call API to generate claim proof with metadata
2. Pass proof data to user's frontend

**User (Frontend):**
1. Connect Solana wallet
2. Build transaction with Ed25519 verification + claim instruction
3. Sign and submit transaction
4. NFT is minted to user's wallet

The NFT is soulbound (non-transferable except by operator) and the metadata is publicly accessible at `/metadata/{id}.json`.
