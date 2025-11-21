# API Server

RESTful API for Fight Tickets NFT claim system.

## Features

- **Ed25519 Signature Generation** - Secure proof generation for NFT claims
- **NFT Metadata Storage & Serving** - Custom metadata per NFT with default fallback
- **SQLite (Dev)** / **PostgreSQL (Prod)** - Environment-based database
- **API Key Authentication** - Secure endpoints
- **Webhook Support** - Alchemy NFT event handling
- **TypeScript** - Full type safety

## Setup

Install dependencies:
```bash
npm install
```

Configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

## Development

Start dev server with hot reload:
```bash
npm run dev
```

## Build

```bash
npm run build
```

## Production

```bash
npm start
```

## API Endpoints

### Health Check
```
GET /health
```

### Generate Claim Proof
```
POST /api/claim/generate
Headers: X-API-Key: <your-api-key>
Body: {
  "walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
  "nftId": 42,
  "metadata": {
    "name": "Fight Ticket #42",
    "description": "VIP ringside seat",
    "image": "https://ticketsnft.fight.foundation/images/42.png",
    "attributes": [
      {"trait_type": "Seat", "value": "Ringside A12"}
    ]
  }
}

Response: {
  "nftId": 42,
  "walletAddress": "...",
  "signature": "...",
  "signerPublicKey": "...",
  "claimId": 1
}
```

### Get User Claims
```
GET /api/claim/user/:walletAddress
Headers: X-API-Key: <your-api-key>

Response: {
  "walletAddress": "...",
  "claims": [...]
}
```

### Get NFT Metadata (Public)
```
GET /metadata/:id.json

Response: {
  "name": "Fight Ticket #42",
  "symbol": "FIGHT",
  "description": "VIP access to championship fight",
  "image": "https://ticketsnft.fight.foundation/images/42.png",
  "attributes": [
    {"trait_type": "Event", "value": "Championship Fight"},
    {"trait_type": "Section", "value": "VIP"}
  ],
  "properties": {
    "category": "image",
    "files": [
      {"uri": "https://...", "type": "image/png"}
    ]
  }
}
```
*Returns custom metadata if provided during claim generation, otherwise returns default metadata from environment variables. Follows Metaplex metadata standard.*

### Webhook (Alchemy)
```
POST /api/webhook/alchemy
Body: <Alchemy webhook payload>
```

## Testing with ngrok

For webhook testing:
```bash
# Start API server
npm run dev

# In another terminal
ngrok http 3000

# Use ngrok URL in Alchemy webhook configuration
```

## Database

**Development**: Uses SQLite at `data/dev.db`

**Production**: Uses PostgreSQL from `DATABASE_URL` env var

### Tables

**users**
- id
- wallet_address (unique)
- created_at

**claims**
- id
- user_id
- nft_id (unique)
- wallet_address
- signature (64-byte Ed25519 signature hex)
- metadata (JSON text, nullable)
- claimed (boolean)
- claimed_at
- created_at

## Integration with Solana Program

1. **Generate Claim**: API creates Ed25519 signature for (recipient + nft_id)
2. **Submit Transaction**: Frontend calls Solana program with signature
3. **On-chain Verification**: Program validates signature using stored signer public key
4. **Mint NFT**: Program creates NFT with Metaplex metadata if signature is valid

### Signature Format

The API signs: `SHA256(recipient_pubkey || nft_id_le_bytes)`

- `recipient_pubkey`: 32 bytes (Solana public key)
- `nft_id_le_bytes`: 4 bytes (u32 little-endian)
- Signature: 64 bytes Ed25519 signature

### Environment Variables

```env
# Contract
NFT_CONTRACT_ADDRESS=6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG
NFT_COLLECTION_ADDRESS=D71pSR8i46Q2rD38AqCCnAMqiJ6Ypd5Nf2TNh5W8aVoU

# Signing (API server)
SIGNING_PRIVATE_KEY=<base58-encoded-ed25519-private-key>
SIGNING_PUBLIC_KEY=HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft

# Metadata defaults
DEFAULT_NFT_NAME="Fight Ticket"
DEFAULT_NFT_DESCRIPTION="Official Fight Foundation Event Ticket"
DEFAULT_NFT_IMAGE="https://ticketsnft.fight.foundation/images/default.png"

# API
API_KEY=your-secret-api-key
PORT=3000

# Database
DATABASE_URL=postgresql://... # Production
# SQLite used automatically in development
```
