# Fight Tickets NFT

Soulbound NFT collection for fight event tickets on Solana. Features claim-based minting with Ed25519 signature verification, operator-only transfers, and updateable metadata.

## Features

- **10,000 NFT Supply** - Fixed collection size
- **Claim-Based Minting** - Users claim NFTs with cryptographic proofs from API
- **Ed25519 Signature Verification** - Secure proof validation using Solana's native ed25519_program
- **Soulbound Tokens** - Only operator can transfer (prevents secondary market trading)
- **Separate API Signer** - API signing key separate from operator/deployer
- **Updateable Metadata** - Base URI can be updated by operator
- **Contract Locking** - Permanent freeze mechanism for all operations
- **Operator Functions** - Burn, transfer, update signer/URI

## Toolchain Versions

- **Solana CLI**: v3.0.11
- **Anchor Framework**: v0.32.0
- **Rust**: 1.84.0
- **Node.js**: v18+ (for tests)
- **Yarn**: v1.22.22

## Prerequisites

Install Solana CLI:
```bash
sh -c "$(curl -sSfL https://release.solana.com/v3.0.11/install)"
```

Install Anchor:
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install 0.32.0
avm use 0.32.0
```

Install Node dependencies:
```bash
yarn install
```

## Build

```bash
anchor build
```

The program binary will be at `target/deploy/fight_tickets_nft.so`

The IDL will be at `target/idl/fight_tickets_nft.json`

## Test

Start local validator:
```bash
solana-test-validator
```

In another terminal, run tests:
```bash
anchor test --skip-local-validator
```

Or run all tests (starts validator automatically):
```bash
anchor test
```

## Deploy

### Localhost
```bash
anchor deploy
```

### Devnet
```bash
anchor deploy --provider.cluster devnet
```

### Mainnet
```bash
anchor deploy --provider.cluster mainnet
```

## Program Instructions

### Initialize Collection
```rust
initialize(signer: Pubkey, base_uri: String)
```
Creates the NFT collection with operator authority and API signer.

### Claim NFT
```rust
claim(proof: [u8; 64], nft_id: u32, recipient: Pubkey)
```
Mints an NFT with valid Ed25519 signature proof from API signer.

### Transfer NFT (Operator Only)
```rust
transfer(nft_id: u32, new_owner: Pubkey)
```
Transfers NFT to new owner. Only callable by operator (soulbound for holders).

### Burn NFT (Operator Only)
```rust
burn(nft_id: u32)
```
Permanently destroys an NFT and refunds rent.

### Update Signer (Operator Only)
```rust
update_signer(new_signer: Pubkey)
```
Updates the API signer public key for proof verification.

### Update Base URI (Operator Only)
```rust
update_base_uri(new_base_uri: String)
```
Updates the metadata base URI (e.g., `https://ticketsnft.fight.foundation`).

### Lock Contract (Operator Only)
```rust
lock_contract()
```
Permanently locks all operations. Cannot be reversed.

## Account Structure

### NftCollection
- `authority: Pubkey` - Operator address
- `signer: Pubkey` - API signer for proof verification
- `is_locked: bool` - Contract lock status
- `total_supply: u32` - Current minted supply
- `base_uri: String` - Metadata base URI

### Nft
- `nft_id: u32` - NFT ID (0-9999)
- `owner: Pubkey` - Current owner
- `collection: Pubkey` - Parent collection reference

## Metadata

The contract stores a `base_uri` in the collection account. Frontend applications construct the full metadata URL as:

```
{base_uri}{nft_id}.json
```

Example: NFT #42 with `base_uri = "https://ticketsnft.fight.foundation"` would resolve to:
```
https://ticketsnft.fight.foundation42.json
```

Each JSON should follow standard metadata format:
```json
{
  "name": "Fight Ticket #42",
  "symbol": "FTKT",
  "image": "https://...",
  "attributes": [
    {"trait_type": "Event", "value": "Championship Fight"},
    {"trait_type": "Section", "value": "VIP"},
    {"trait_type": "Seat", "value": "A-42"}
  ]
}
```

## Security

- All proofs must be signed by the authorized API signer
- Ed25519 signatures verified on-chain via `ed25519_program` syscall
- Operator-only functions protected by authority checks
- Contract lock mechanism prevents changes after finalization

## License

MIT
