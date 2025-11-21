# Fight Tickets NFT

Solana smart contract and API system for Fight Foundation ticketing with Metaplex NFTs.

## Projects

### Fight Tickets NFT (Solana Program)
Production-ready soulbound NFT collection with Metaplex Token Metadata for fight event tickets.

See [fight_tickets_nft/README.md](fight_tickets_nft/README.md) for full documentation.

### API Server
RESTful API for generating Ed25519 claim proofs and serving NFT metadata.

See [API_README.md](API_README.md) for API documentation.

## Deployed Addresses

### Devnet
- **Program**: `6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG`
- **Collection**: `D71pSR8i46Q2rD38AqCCnAMqiJ6Ypd5Nf2TNh5W8aVoU`

## Quick Start

Install dependencies:
```bash
# Solana CLI v3.0.11
sh -c "$(curl -sSfL https://release.solana.com/v3.0.11/install)"

# Anchor v0.32.0
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.0
avm use 0.32.0
```

Build and test:
```bash
cd fight_tickets_nft
yarn install

# Build (use cargo build-sbf due to anchor-syn v0.30.1 IDL generation issue)
cargo build-sbf

# Deploy to devnet
solana program deploy --url devnet target/deploy/fight_tickets_nft.so --program-id target/deploy/fight_tickets_nft-keypair.json

# Test manually with scripts
node scripts/claim-with-metadata.cjs <nftId> <recipient> <signature> <name> <uri>
```

See [fight_tickets_nft/BUILD_NOTES.md](fight_tickets_nft/BUILD_NOTES.md) for build details.

## Repository Structure

```
fight-ticket/
├── fight_tickets_nft/      # Solana NFT program (Anchor)
│   ├── programs/
│   │   └── fight_tickets_nft/
│   │       └── src/lib.rs
│   ├── scripts/
│   │   ├── claim-with-metadata.cjs
│   │   └── inspect-nft.cjs
│   ├── tests/
│   ├── target/
│   │   ├── deploy/
│   │   ├── idl/
│   │   └── types/
│   └── README.md
├── src/                    # API server (TypeScript)
│   ├── db/
│   ├── middleware/
│   ├── routes/
│   ├── utils/
│   └── index.ts
├── data/                   # SQLite database (dev)
├── test-user.json          # Test keypairs
├── test-user-2.json
├── .env.example
├── API_README.md
└── README.md
```

## Security

This repository uses `git-secret` to encrypt sensitive files.

Setup:
```bash
# Add yourself as a user
git secret tell your-email@example.com

# Hide .env file
git secret hide .env

# Reveal encrypted files
git secret reveal
```

## License

MIT
