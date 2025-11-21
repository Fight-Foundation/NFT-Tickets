# Fight Tickets NFT

Soulbound NFT collection for fight event tickets on Solana with Metaplex Token Metadata. Features claim-based minting with Ed25519 signature verification, operator-only transfers, and on-chain metadata.

## Features

- **10,000 NFT Supply** - Fixed collection size
- **Claim-Based Minting** - Users claim NFTs with cryptographic proofs from API
- **Ed25519 Signature Verification** - Secure proof validation using Solana's native ed25519_program
- **Metaplex Token Metadata** - Full metadata support with collection linking for wallet/explorer visibility
- **Soulbound Tokens** - Only operator can transfer (prevents secondary market trading)
- **Separate API Signer** - API signing key separate from operator/deployer
- **Contract Locking** - Permanent freeze mechanism for all operations
- **Operator Functions** - Burn, transfer, update signer

## Deployed Addresses

### Devnet
- **Program ID**: `6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG`
- **Collection**: `D71pSR8i46Q2rD38AqCCnAMqiJ6Ypd5Nf2TNh5W8aVoU`
- **Collection Mint**: `B4Ef4SzvDH1ZsfaoDoGcC82xbosPpDAjvASqEjr4THxt`

## Toolchain Versions

- **Solana CLI**: v3.0.11
- **Anchor Framework**: v0.30.1 (program) / v0.32.0 (client)
- **Rust**: 1.84.0
- **mpl-token-metadata**: v4.1.2
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

**Note**: Due to a known issue with `anchor-syn` v0.30.1 and IDL generation, use `cargo build-sbf` directly:

```bash
cargo build-sbf
```

The program binary will be at `target/deploy/fight_tickets_nft.so`

The IDL is pre-generated and available at `target/idl/fight_tickets_nft.json`

**Alternative** (if you need to regenerate IDL): Upgrade to Anchor v0.31+ by updating `Cargo.toml` dependencies, though this may require additional testing.

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

**Note**: Use `cargo build-sbf` before deploying:

```bash
cargo build-sbf
```

### Devnet
```bash
solana program deploy --url devnet target/deploy/fight_tickets_nft.so --program-id target/deploy/fight_tickets_nft-keypair.json
```

### Mainnet
```bash
solana program deploy --url mainnet target/deploy/fight_tickets_nft.so --program-id target/deploy/fight_tickets_nft-keypair.json
```

**Alternative Deployment** (if `anchor deploy` works with your Anchor version):
```bash
anchor deploy --provider.cluster devnet
```

## Program Instructions

### Initialize Collection
```rust
initialize(
    signer: Pubkey,
    base_uri: String,
    collection_name: String,
    collection_symbol: String
)
```
Creates the NFT collection with Metaplex metadata, operator authority, and API signer.

### Claim NFT
```rust
claim(
    proof: [u8; 64],
    nft_id: u32,
    recipient: Pubkey,
    name: String,
    uri: String
)
```
Mints an NFT with Metaplex metadata using valid Ed25519 signature proof from API signer.

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
- `collection_mint: Pubkey` - Collection NFT mint address

### Nft
- `nft_id: u32` - NFT ID (0-9999)
- `owner: Pubkey` - Current owner
- `collection: Pubkey` - Parent collection reference
- `mint: Pubkey` - NFT mint address

## Metadata

### Metaplex Token Metadata

Each NFT has on-chain Metaplex Token Metadata including:
- **Name**: Provided during claim (e.g., "Fight Ticket #42")
- **Symbol**: "FIGHT"
- **URI**: Metadata JSON URL (provided during claim)
- **Collection**: Linked to collection mint for proper grouping
- **Master Edition**: Each NFT is a unique master edition (max_supply = 0)

### Metadata JSON Format

The URI should point to a JSON file following Metaplex standard:
```json
{
  "name": "Fight Ticket #42",
  "symbol": "FIGHT",
  "description": "VIP access to championship fight",
  "image": "https://ticketsnft.fight.foundation/images/42.png",
  "attributes": [
    {"trait_type": "Event", "value": "Championship Fight"},
    {"trait_type": "Section", "value": "VIP"},
    {"trait_type": "Seat", "value": "A-42"}
  ],
  "properties": {
    "category": "image",
    "files": [
      {
        "uri": "https://ticketsnft.fight.foundation/images/42.png",
        "type": "image/png"
      }
    ]
  }
}
```

### Visibility

With Metaplex metadata, NFTs are automatically visible in:
- Phantom wallet
- Solflare wallet
- Solana Explorer
- Magic Eden
- Other Solana NFT platforms

## Scripts

### Claim NFT
```bash
node scripts/claim-with-metadata.cjs <nftId> <recipientPubkey> <signatureHex> <name> <uri>
```

Environment variables:
- `NFT_COLLECTION_ADDRESS` - Collection account address
- `ANCHOR_WALLET` - Path to payer keypair JSON
- `ANCHOR_PROVIDER_URL` - Solana RPC URL (default: devnet)

Example:
```bash
NFT_COLLECTION_ADDRESS=D71pSR8i46Q2rD38AqCCnAMqiJ6Ypd5Nf2TNh5W8aVoU \
ANCHOR_WALLET=./test-user.json \
node scripts/claim-with-metadata.cjs \
  42 \
  HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft \
  <64-byte-signature-hex> \
  "Fight Ticket #42" \
  "https://ticketsnft.fight.foundation/metadata/42.json"
```

### Inspect NFT
```bash
node scripts/inspect-nft.cjs <nftId>
```

## Security

- All proofs must be signed by the authorized API signer
- Ed25519 signatures verified on-chain via `ed25519_program` syscall
- Operator-only functions protected by authority checks
- Contract lock mechanism prevents changes after finalization
- Associated Token Accounts created internally via CPI
- Metaplex metadata is immutable after creation

## License

MIT
