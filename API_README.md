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
  "description": "...",
  "image": "...",
  "attributes": [...]
}
```
*Returns custom metadata if provided during claim generation, otherwise returns default metadata from environment variables.*

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
- signature
- metadata (JSON text, nullable)
- claimed (boolean)
- claimed_at
- created_at
