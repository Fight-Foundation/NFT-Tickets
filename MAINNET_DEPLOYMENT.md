# Mainnet Deployment Summary

## 🚀 Deployment Details

**Date:** 2024
**Network:** Solana Mainnet-beta
**Status:** ✅ Successfully Deployed and Initialized

## 📋 Contract Addresses

### Program
- **Program ID:** `6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG`
- **Deployment Transaction:** [5bsL22wzsSwmAyGkj1N1nooFnXK39W73HgALg6CjtwuwAK7jw2pXjtVfHq2bJWYR5MahfT6gdh5jPNRazdeEUxf3](https://solscan.io/tx/5bsL22wzsSwmAyGkj1N1nooFnXK39W73HgALg6CjtwuwAK7jw2pXjtVfHq2bJWYR5MahfT6gdh5jPNRazdeEUxf3)
- **Binary Size:** 359 KB
- **Deployment Cost:** ~1.8 SOL

### Collection
- **Collection Account:** `2KnpADRtu1mwoaxejikvZSUDzWNXPHaHFDrQckNAECiZ`
- **Collection Mint:** `FwShwjHzh8AFm7qDA234GwNXrpWHb7RcuRALbtBGE476`
- **Initialization Transaction:** [5Mk1A2z81ujTmxKBu4cdGLf6Vs9HBfbh3mrMPy81QEVKFED7Zucu2SZCtg3aRZUHtAv8yiNRAUJUYDJcuuB3pqaM](https://solscan.io/tx/5Mk1A2z81ujTmxKBu4cdGLf6Vs9HBfbh3mrMPy81QEVKFED7Zucu2SZCtg3aRZUHtAv8yiNRAUJUYDJcuuB3pqaM)
- **Name:** Fight Tickets
- **Symbol:** FIGHT
- **Base URI:** https://ticketsnft.fight.foundation/metadata/

### Metadata Accounts (Metaplex)
- **Collection Metadata:** `Ex1AGCxwMnHUMRGsEEcgaX7o3sR4863N9rFj69cjXhLN`
- **Collection Master Edition:** `EiY9ndH4AGQkG17mmdK6brf2FTQcAyiQxuS2f5dbRQaR`
- **Collection Token Account:** `9hdBeoht1cdZzWwzqvyVr1RRA3xP7DPRszQmBayQWAWL`

### Authority & Signers
- **Authority (Deployer):** `B4Ef4SzvDH1ZsfaoDoGcC82xbosPpDAjvASqEjr4THxt`
- **API Signer:** `HQ2FdnP3RgZtPpqJgik2VKoa9x3hJWEFpfFg774uUAQc`

## 🔑 Keypairs

### Collection Keypair
- **File:** `fight_tickets_nft/collection-mainnet-keypair.json`
- **Public Key:** `2KnpADRtu1mwoaxejikvZSUDzWNXPHaHFDrQckNAECiZ`
- **Seed Phrase:** "rally stomach charge veteran drastic type volume ranch govern stuff dinosaur fire"

### API Signer Keypair
- **File:** `production-signer.json`
- **Public Key:** `HQ2FdnP3RgZtPpqJgik2VKoa9x3hJWEFpfFg774uUAQc`
- **Private Key (Base58):** `5h3pinU1g5EwDRZTi5WjXnHHvr7GkDW8vLYvxxvaKbaXVpwecBBteLCniMqwc7P84RzswCeif1kHi8eT5zTeYqcY`
- **Purpose:** Signs claim proofs on the API side

## 🔧 Environment Configuration

Updated `.env` file with production values:

```env
NODE_ENV=production
NFT_CONTRACT_ADDRESS=6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG
NFT_COLLECTION_ADDRESS=2KnpADRtu1mwoaxejikvZSUDzWNXPHaHFDrQckNAECiZ
NFT_COLLECTION_MINT=FwShwjHzh8AFm7qDA234GwNXrpWHb7RcuRALbtBGE476
SIGNING_PUBLIC_KEY=HQ2FdnP3RgZtPpqJgik2VKoa9x3hJWEFpfFg774uUAQc
SIGNING_PRIVATE_KEY=5h3pinU1g5EwDRZTi5WjXnHHvr7GkDW8vLYvxxvaKbaXVpwecBBteLCniMqwc7P84RzswCeif1kHi8eT5zTeYqcY
SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/smnuMCQsdRA7hm4I4IHsB
DATABASE_URL=postgresql://neondb_owner:npg_XIdDHr1Jn2uy@ep-red-snow-a4bbo5hb-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## 📦 Technical Details

### Metaplex Integration
- **Metaplex Program:** `metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s`
- **Version:** Token Metadata v4.1.2
- **Features:** 
  - Collection-based NFTs with verified collection
  - Metadata accounts for each NFT
  - Master editions for uniqueness
  - Verified creators

### Program Features
- **Max Supply:** 10,000 NFTs
- **Claim Mechanism:** Ed25519 signature verification
- **NFT Structure:** 
  - Collection → Collection Mint → Individual NFTs
  - Each NFT is part of verified collection
  - Unique token IDs from 1 to 10,000

## 🛠️ Deployment Process

### 1. Build
```bash
cd fight_tickets_nft
cargo build-sbf
```

### 2. Switch to Mainnet
```bash
solana config set --url mainnet-beta
```

### 3. Deploy Program
```bash
solana program deploy target/deploy/fight_tickets_nft.so
```

### 4. Generate Production Keypairs
```bash
# API Signer
solana-keygen new -o production-signer.json

# Collection
solana-keygen new -o collection-mainnet-keypair.json
```

### 5. Initialize Collection
```bash
cd fight_tickets_nft
node scripts/init-mainnet.cjs
```

## ✅ Post-Deployment Checklist

- [x] Program deployed to mainnet
- [x] Collection initialized with Metaplex metadata
- [x] Production keypairs generated
- [x] Environment variables updated
- [ ] API deployed to production (Vercel/Railway)
- [ ] Alchemy webhook configured for mainnet
- [ ] First test claim on mainnet
- [ ] Database migration to production
- [ ] Security audit items addressed:
  - [ ] Rate limiting added
  - [ ] CORS configured for specific domains
  - [ ] Input validation added
  - [ ] Proper logging configured
  - [ ] Helmet.js for security headers

## 🚨 Security Considerations

### Critical Files
- `production-signer.json` - Contains private key, **NEVER commit to git**
- `collection-mainnet-keypair.json` - Collection authority, **encrypted with git-secret**
- Authority wallet keypair at `~/solana-key-loader/keypair.json`

### Recommendations
1. **Rate Limiting:** Add express-rate-limit to prevent abuse
2. **CORS:** Configure for specific domains only
3. **Input Validation:** Use joi/zod for all endpoints
4. **Logging:** Set up winston/pino for production
5. **Monitoring:** Set up alerts for failed transactions
6. **Backup:** Store seed phrases securely offline

## 🔗 Useful Links

- [Program Explorer (Solscan)](https://solscan.io/account/6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG)
- [Collection Explorer (Solscan)](https://solscan.io/account/2KnpADRtu1mwoaxejikvZSUDzWNXPHaHFDrQckNAECiZ)
- [Deployment Transaction](https://solscan.io/tx/5bsL22wzsSwmAyGkj1N1nooFnXK39W73HgALg6CjtwuwAK7jw2pXjtVfHq2bJWYR5MahfT6gdh3mrMPy81QEVKFED7Zucu2SZCtg3aRZUHtAv8yiNRAUJUYDJcuuB3pqaM)
- [Initialization Transaction](https://solscan.io/tx/5Mk1A2z81ujTmxKBu4cdGLf6Vs9HBfbh3mrMPy81QEVKFED7Zucu2SZCtg3aRZUHtAv8yiNRAUJUYDJcuuB3pqaM)

## 📝 Next Steps

1. **Test Claim Flow:**
   - Create test claim proof with production signer
   - Submit transaction on mainnet
   - Verify NFT appears in wallet
   - Check metadata on explorers

2. **Deploy API:**
   - Push code to production (Vercel/Railway)
   - Configure environment variables
   - Test endpoints
   - Configure Alchemy webhook for mainnet

3. **Monitoring:**
   - Set up Sentry for error tracking
   - Configure logging service
   - Monitor transaction success rates
   - Track gas costs

4. **Security Hardening:**
   - Implement rate limiting
   - Add input validation
   - Configure CORS properly
   - Add security headers
   - Set up monitoring alerts

## 🐛 Troubleshooting

### Common Issues

1. **"AccountNotEnoughKeys" Error**
   - Solution: Ensure sysvar_instructions is included twice in account list (known Anchor quirk)

2. **"Signer privilege escalated" Error**
   - Solution: Ensure `init` accounts (collection_mint) are marked as signers and keypairs are passed

3. **Metaplex Metadata Not Showing**
   - Verify metadata PDAs are derived correctly
   - Check base_uri format (should end with /)
   - Ensure metadata JSON is accessible

## 💰 Cost Breakdown

- **Program Deployment:** ~1.8 SOL
- **Collection Initialization:** ~0.02 SOL
- **Per NFT Claim:** ~0.01-0.02 SOL (paid by claimer)
- **Total Initial Cost:** ~1.82 SOL

## 📊 Collection Configuration

```javascript
{
  name: "Fight Tickets",
  symbol: "FIGHT",
  baseUri: "https://ticketsnft.fight.foundation/metadata/",
  maxSupply: 10000,
  collectionDetails: {
    size: 0 // Increments with each mint
  }
}
```

## 🔐 Verification (Optional)

To verify the program on Solana Explorer:
```bash
solana-verify build
solana-verify upload-source --program-id 6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG
```

Note: Verification is optional but recommended for transparency.
