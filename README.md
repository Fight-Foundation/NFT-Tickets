# Fight Tickets NFT

Solana smart contract projects for Fight Foundation ticketing system.

## Projects

### Counter Program
Simple counter example demonstrating basic Solana/Anchor program structure.

### Fight Tickets NFT
Production-ready soulbound NFT collection for fight event tickets.

See [fight_tickets_nft/README.md](fight_tickets_nft/README.md) for full documentation.

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
anchor build
anchor test
```

## Repository Structure

```
fight-ticket/
├── counter_program/        # Simple counter example
│   ├── programs/
│   └── tests/
├── fight_tickets_nft/      # Main NFT contract
│   ├── programs/
│   │   └── fight_tickets_nft/
│   │       └── src/
│   │           └── lib.rs
│   ├── tests/
│   ├── target/
│   │   ├── deploy/
│   │   ├── idl/
│   │   └── types/
│   └── README.md
├── .env.example
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
