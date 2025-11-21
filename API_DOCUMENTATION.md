# Fight Tickets NFT API Documentation

Complete API reference for the Fight Tickets NFT claim system.

## Base URL

```
Development: http://localhost:3000
Production: https://your-domain.com
```

## Authentication

All API endpoints (except webhooks and health check) require an API key in the request header:

```
X-API-Key: your_api_key_here
```

Or as a query parameter:

```
?api_key=your_api_key_here
```

## Endpoints

### Health Check

Check if the API server is running.

**Endpoint:** `GET /health`

**Authentication:** None required

**Example Request:**
```bash
curl http://localhost:3000/health
```

**Example Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T17:30:45.123Z"
}
```

---

### Generate Claim Proof

Generate an Ed25519 signature proof for a user to claim an NFT.

**Endpoint:** `POST /api/claim/generate`

**Authentication:** Required

**Request Body:**
```json
{
  "walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
  "nftId": 42,
  "metadata": {
    "name": "Fight Ticket #42",
    "description": "VIP access to championship fight",
    "image": "https://ticketsnft.fight.foundation/images/42.png",
    "attributes": [
      {
        "trait_type": "Event",
        "value": "Championship Fight"
      },
      {
        "trait_type": "Seat",
        "value": "Ringside A12"
      }
    ]
  }
}
```

**Parameters:**
- `walletAddress` (string, required) - Valid Solana wallet address (base58 encoded public key)
- `nftId` (number, required) - NFT ID between 0-9999
- `metadata` (object, required) - NFT metadata JSON object following OpenSea metadata standard

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/claim/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key_12345" \
  -d '{
    "walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
    "nftId": 42,
    "metadata": {
      "name": "Fight Ticket #42",
      "description": "VIP access to championship fight",
      "image": "https://ticketsnft.fight.foundation/images/42.png",
      "attributes": [
        {"trait_type": "Event", "value": "Championship Fight"},
        {"trait_type": "Seat", "value": "Ringside A12"}
      ]
    }
  }'
```

**Example Response:**
```json
{
  "nftId": 42,
  "walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
  "signature": "a1b2c3d4e5f6...0123456789abcdef",
  "signerPublicKey": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
  "claimId": 123,
  "message": "Claim proof generated successfully"
}
```

**Response Fields:**
- `nftId` - The NFT ID that can be claimed
- `walletAddress` - The recipient's wallet address
- `signature` - Hex-encoded Ed25519 signature (128 characters, 64 bytes)
- `signerPublicKey` - Public key of the API signer (base58 encoded)
- `claimId` - Database ID of this claim record
- `message` - Success message

**Error Responses:**

*Missing API Key (401):*
```json
{
  "error": "Unauthorized: Invalid API key"
}
```

*Missing Parameters (400):*
```json
{
  "error": "walletAddress, nftId, and metadata are required"
}
```

*Invalid Metadata (400):*
```json
{
  "error": "metadata must be a JSON object"
}
```

*Invalid Wallet Address (400):*
```json
{
  "error": "Invalid Solana wallet address"
}
```

*NFT ID Out of Range (400):*
```json
{
  "error": "NFT ID must be between 0 and 9999"
}
```

---

### Get User Claims

Retrieve all claim proofs generated for a specific wallet address.

**Endpoint:** `GET /api/claim/user/:walletAddress`

**Authentication:** Required

**Path Parameters:**
- `walletAddress` (string, required) - Valid Solana wallet address

**Example Request:**
```bash
curl http://localhost:3000/api/claim/user/HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft \
  -H "X-API-Key: dev_api_key_12345"
```

**Example Response:**
```json
{
  "walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
  "claims": [
    {
      "nftId": 42,
      "signature": "a1b2c3d4e5f6...0123456789abcdef",
      "claimed": false,
      "claimedAt": null,
      "createdAt": "2025-11-20T17:30:45.123Z"
    },
    {
      "nftId": 100,
      "signature": "fedcba98765...456789abcdef0123",
      "claimed": true,
      "claimedAt": "2025-11-20T18:15:30.456Z",
      "createdAt": "2025-11-20T17:25:10.789Z"
    }
  ]
}
```

**Response Fields:**
- `walletAddress` - The wallet address queried
- `claims` - Array of claim objects
  - `nftId` - The NFT ID
  - `signature` - The claim proof signature
  - `claimed` - Whether the NFT has been claimed on-chain
  - `claimedAt` - Timestamp when claimed (null if not claimed)
  - `createdAt` - Timestamp when proof was generated

**Error Responses:**

*Invalid Wallet Address (400):*
```json
{
  "error": "Invalid Solana wallet address"
}
```

---

### Alchemy Webhook

Receive NFT mint/transfer event notifications from Alchemy.

**Endpoint:** `POST /api/webhook/alchemy`

**Authentication:** Optional (webhook signature verification)

**Headers:**
- `X-Alchemy-Signature` (optional) - Webhook signature for verification

**Example Request:**
```bash
curl -X POST http://localhost:3000/api/webhook/alchemy \
  -H "Content-Type: application/json" \
  -H "X-Alchemy-Signature: your_signature" \
  -d '{
    "webhookId": "wh_abc123",
    "event": {
      "activity": [
        {
          "category": "token",
          "fromAddress": "0x0000000000000000000000000000000000000000",
          "toAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft",
          "value": 1
        }
      ]
    }
  }'
```

**Example Response:**
```json
{
  "success": true,
  "processed": true
}
```

---

### Webhook Health Check

Check webhook endpoint health.

**Endpoint:** `GET /api/webhook/health`

**Authentication:** None required

**Example Request:**
```bash
curl http://localhost:3000/api/webhook/health
```

**Example Response:**
```json
{
  "status": "ok",
  "endpoint": "webhook"
}
```

---

### Get NFT Metadata

Retrieve metadata for a specific NFT. Returns custom metadata if the NFT has been claimed with custom metadata, otherwise returns default metadata.

**Endpoint:** `GET /metadata/:id.json`

**Authentication:** None required (public endpoint)

**Path Parameters:**
- `id` (number, required) - NFT ID between 0-9999

**Example Request:**
```bash
curl http://localhost:3000/metadata/42.json
```

**Example Response (with custom metadata):**
```json
{
  "name": "Fight Ticket #42",
  "description": "VIP access to championship fight",
  "image": "https://ticketsnft.fight.foundation/images/42.png",
  "attributes": [
    {
      "trait_type": "Event",
      "value": "Championship Fight"
    },
    {
      "trait_type": "Seat",
      "value": "Ringside A12"
    }
  ]
}
```

**Example Response (default metadata):**
```json
{
  "name": "Fight Ticket #999",
  "description": "Soulbound NFT ticket for fight events",
  "image": "https://ticketsnft.fight.foundation/images/999.png",
  "attributes": [
    {
      "trait_type": "NFT ID",
      "value": 999
    },
    {
      "trait_type": "Type",
      "value": "Soulbound Ticket"
    }
  ]
}
```

**Error Responses:**

*Invalid NFT ID (404):*
```json
{
  "error": "Invalid NFT ID"
}
```

**Use Cases:**
- On-chain programs can reference this endpoint in the NFT's `uri` field
- Wallets and marketplaces fetch metadata to display NFT information
- Default metadata is served for unclaimed NFTs
- Custom metadata is served after claim generation with metadata

---

## Client Integration Example

### JavaScript/TypeScript

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';

// API Configuration
const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'dev_api_key_12345';

// Generate claim proof
async function generateClaimProof(walletAddress: string, nftId: number, metadata: any) {
  const response = await fetch(`${API_BASE_URL}/api/claim/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY
    },
    body: JSON.stringify({
      walletAddress,
      nftId,
      metadata
    })
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  
  return await response.json();
}

// Claim NFT on-chain
async function claimNft(userWallet: Keypair, nftId: number) {
  // 1. Generate proof from API with metadata
  const metadata = {
    name: `Fight Ticket #${nftId}`,
    description: 'VIP access to championship fight',
    image: `https://ticketsnft.fight.foundation/images/${nftId}.png`,
    attributes: [
      { trait_type: 'Seat', value: 'Ringside A12' },
      { trait_type: 'Access', value: 'VIP' }
    ]
  };
  const proof = await generateClaimProof(userWallet.publicKey.toBase58(), nftId, metadata);
  console.log('Claim proof generated:', proof);
  
  // 2. Convert signature to bytes for on-chain verification
  const signatureBytes = Buffer.from(proof.signature, 'hex');
  
  // 3. Create Ed25519 verification instruction
  const ed25519Instruction = createEd25519Instruction(
    signatureBytes,
    new PublicKey(proof.signerPublicKey),
    messageHash
  );
  
  // 4. Send transaction with claim instruction
  const connection = new Connection('https://api.devnet.solana.com');
  const transaction = new Transaction();
  
  transaction.add(ed25519Instruction);
  transaction.add(claimInstruction); // Your Anchor program claim instruction
  
  const signature = await connection.sendTransaction(transaction, [userWallet]);
  await connection.confirmTransaction(signature);
  
  console.log('NFT claimed! Signature:', signature);
}

// Usage
const userWallet = Keypair.generate();
await claimNft(userWallet, 42);

// Fetch metadata
async function getMetadata(nftId: number) {
  const response = await fetch(`${API_BASE_URL}/metadata/${nftId}.json`);
  return await response.json();
}

const metadata = await getMetadata(42);
console.log('NFT metadata:', metadata);
```

### cURL Examples

**Generate multiple claims:**
```bash
# Claim NFT #1
curl -X POST http://localhost:3000/api/claim/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key_12345" \
  -d '{"walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft", "nftId": 1, "metadata": {"name": "Ticket #1", "description": "General admission", "image": "https://example.com/1.png"}}'

# Claim NFT #2
curl -X POST http://localhost:3000/api/claim/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key_12345" \
  -d '{"walletAddress": "HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft", "nftId": 2, "metadata": {"name": "Ticket #2", "description": "VIP access", "image": "https://example.com/2.png"}}'
```

**Check user's claims:**
```bash
curl http://localhost:3000/api/claim/user/HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft \
  -H "X-API-Key: dev_api_key_12345" | jq
```

**Fetch NFT metadata:**
```bash
# Get metadata for NFT #42
curl http://localhost:3000/metadata/42.json | jq

# Get metadata for multiple NFTs
for i in {0..5}; do
  echo "NFT #$i:"
  curl -s http://localhost:3000/metadata/$i.json | jq .name
done
```

### Python Example

```python
import requests
import json

API_BASE_URL = 'http://localhost:3000'
API_KEY = 'dev_api_key_12345'

def generate_claim_proof(wallet_address: str, nft_id: int, metadata: dict):
    """Generate a claim proof for an NFT."""
    response = requests.post(
        f'{API_BASE_URL}/api/claim/generate',
        headers={
            'Content-Type': 'application/json',
            'X-API-Key': API_KEY
        },
        json={
            'walletAddress': wallet_address,
            'nftId': nft_id,
            'metadata': metadata
        }
    )
    response.raise_for_status()
    return response.json()

def get_user_claims(wallet_address: str):
    """Get all claims for a user."""
    response = requests.get(
        f'{API_BASE_URL}/api/claim/user/{wallet_address}',
        headers={'X-API-Key': API_KEY}
    )
    response.raise_for_status()
    return response.json()

def get_metadata(nft_id: int):
    """Get metadata for an NFT."""
    response = requests.get(f'{API_BASE_URL}/metadata/{nft_id}.json')
    response.raise_for_status()
    return response.json()

# Usage
wallet = 'HvQLhYwzWFxXWhnRB8F3pfH3V7KYpjy9SzWjxvFwbnft'
metadata = {
    'name': 'Fight Ticket #42',
    'description': 'VIP ringside seat',
    'image': 'https://ticketsnft.fight.foundation/images/42.png',
    'attributes': [
        {'trait_type': 'Seat', 'value': 'Ringside A12'},
        {'trait_type': 'Access', 'value': 'VIP'}
    ]
}
proof = generate_claim_proof(wallet, 42, metadata)
print(f"Generated proof: {proof['signature'][:20]}...")

claims = get_user_claims(wallet)
print(f"Total claims: {len(claims['claims'])}")

# Fetch metadata
nft_metadata = get_metadata(42)
print(f"NFT name: {nft_metadata['name']}")
print(f"NFT image: {nft_metadata['image']}")
```

---

## Signature Format

The API generates Ed25519 signatures compatible with Solana's on-chain verification:

**Message Construction:**
```
message = recipient_pubkey (32 bytes) + nft_id (4 bytes, little-endian)
hash = SHA256(message)
signature = Ed25519.sign(hash, private_key)
```

**Signature Properties:**
- Format: Hex-encoded string (128 characters)
- Size: 64 bytes
- Algorithm: Ed25519
- Hash: SHA-256

**On-Chain Verification:**
The signature must be verified using Solana's `ed25519_program` in the same transaction before the claim instruction:

```rust
// In your Solana program
let ix = load_instruction_at_checked(0, instruction_sysvar)?;
require!(ix.program_id == ed25519_program::ID, ErrorCode::InvalidProof);
// Verify signature matches expected message and signer
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production deployment, consider adding:
- Per-IP rate limiting
- Per-API-key rate limiting
- Request throttling for claim generation

---

## Error Handling

All errors follow this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (invalid/missing API key)
- `500` - Internal Server Error

---

## Database Schema

**users table:**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**claims table:**
```sql
CREATE TABLE claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  nft_id INTEGER NOT NULL UNIQUE,
  wallet_address TEXT NOT NULL,
  signature TEXT NOT NULL,
  metadata TEXT,
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## Testing

Use the provided test suite to verify API functionality:

```bash
npm test
```

Test coverage includes:
- Ed25519 signature generation and verification (12 tests)
- API endpoint validation (20 tests)
- Metadata endpoint (5 tests)
- Authentication checks
- Input validation (including metadata validation)
- Error handling

**Total: 37 tests passing**

---

## Security Considerations

1. **API Key Security:** Store API keys securely, never commit to version control
2. **HTTPS Only:** Use HTTPS in production
3. **Signature Verification:** All signatures are cryptographically verified on-chain
4. **Input Validation:** All inputs are validated before processing
5. **Rate Limiting:** Implement rate limiting in production
6. **Webhook Signatures:** Verify Alchemy webhook signatures before processing

---

## Support

For issues or questions:
- GitHub: https://github.com/Fight-Foundation/NFT-Tickets
- Email: alex@ksso.net
