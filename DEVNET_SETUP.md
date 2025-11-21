# Devnet Development Environment Setup

## Overview

This document describes the development environment configuration for testing the Fight Tickets NFT system on Solana Devnet.

## Environment Configuration

### File: `.env.development`

```bash
NODE_ENV=production          # Use PostgreSQL instead of SQLite
DATABASE_URL=postgresql://... # Neon PostgreSQL database
SOLANA_RPC_URL=https://api.devnet.solana.com
```

### Test User Keypair

**Location:** `test-user.json`  
**Public Key:** `FkRuurSenxyNF4bTW1JwegUTaCout3FNWamBgFS8vbsz`

**Get Devnet SOL:**
```bash
solana airdrop 2 FkRuurSenxyNF4bTW1JwegUTaCout3FNWamBgFS8vbsz --url devnet
```

Or use: https://faucet.solana.com/

## Infrastructure

### Database: Neon PostgreSQL
- **Provider:** Neon (Serverless PostgreSQL)
- **Region:** us-east-1
- **Connection:** Pooled connection with SSL
- **Tables:** `users`, `claims` (with metadata field)

### API Server
- **Port:** 3000
- **Tunnel:** ngrok (for public webhook access)
- **Endpoints:**
  - Health: `GET /health`
  - Generate Claim: `POST /api/claim/generate`
  - Get Claims: `GET /api/claim/user/:wallet`
  - Metadata: `GET /metadata/:id.json`
  - Webhook: `POST /api/webhook/alchemy`

### Smart Contract
- **Network:** Solana Devnet
- **Framework:** Anchor v0.32.0
- **Program:** fight_tickets_nft
- **Location:** `fight_tickets_nft/`

## Deployment Steps

### Option 1: Automated Deployment

```bash
./deploy-devnet.sh
```

This script will:
1. Build the smart contract
2. Deploy to Solana Devnet
3. Initialize the NFT collection
4. Start the API server with PostgreSQL
5. Start ngrok tunnel
6. Display all URLs and configuration

### Option 2: Manual Deployment

#### 1. Deploy Smart Contract

```bash
cd fight_tickets_nft
anchor build
solana config set --url devnet
anchor deploy

# Get program ID
PROGRAM_ID=$(solana address -k target/deploy/fight_tickets_nft-keypair.json)
echo $PROGRAM_ID
```

#### 2. Update Environment

```bash
cd ..
# Update .env.development with program ID
nano .env.development
# Set NFT_CONTRACT_ADDRESS=<your-program-id>
```

#### 3. Initialize Collection

```bash
cd fight_tickets_nft
# Create initialization script or use anchor test
anchor test --skip-deploy
```

#### 4. Start API Server

```bash
cd ..
NODE_ENV=production npm start
```

#### 5. Start ngrok

```bash
ngrok http 3000
```

Copy the ngrok URL and update `.env.development`:
```
API_BASE_URL=https://xxxx-xx-xx-xxx-xxx.ngrok.io
BASE_URI=https://xxxx-xx-xx-xxx-xxx.ngrok.io/metadata
```

## Testing

### 1. Test API Health

```bash
curl https://your-ngrok-url.ngrok.io/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-11-20T..."
}
```

### 2. Generate Claim Proof

```bash
curl -X POST https://your-ngrok-url.ngrok.io/api/claim/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev_api_key_12345" \
  -d '{
    "walletAddress": "FkRuurSenxyNF4bTW1JwegUTaCout3FNWamBgFS8vbsz",
    "nftId": 0,
    "metadata": {
      "name": "Test Ticket #0",
      "description": "Test NFT for devnet",
      "image": "https://example.com/test.png",
      "attributes": [
        {"trait_type": "Event", "value": "Test Event"}
      ]
    }
  }'
```

### 3. Fetch Metadata

```bash
curl https://your-ngrok-url.ngrok.io/metadata/0.json
```

### 4. Test On-Chain Claim

See `PARTNER_INTEGRATION.md` for frontend implementation.

## Alchemy Webhook Configuration

### Add Webhook in Alchemy Dashboard

1. Go to: https://dashboard.alchemy.com
2. Navigate to Webhooks
3. Create new webhook:
   - **Type:** NFT Activity
   - **URL:** `https://your-ngrok-url.ngrok.io/api/webhook/alchemy`
   - **Network:** Solana Devnet
   - **Contract Address:** Your program ID

## Monitoring

### Check Database

```bash
# Connect to Neon database
psql 'postgresql://neondb_owner:npg_XIdDHr1Jn2uy@ep-shiny-mode-a4g47p5z-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'

# View tables
\dt

# Check claims
SELECT * FROM claims;

# Check users
SELECT * FROM users;
```

### Check Logs

```bash
# API server logs (if running with npm start)
# Check terminal output

# Or use PM2 for production
pm2 logs
```

### Check ngrok Traffic

Visit: http://localhost:4040

This shows all HTTP requests going through the tunnel.

## Troubleshooting

### Issue: Database connection failed

**Solution:** Check PostgreSQL connection string and SSL settings:
```bash
psql 'postgresql://...' -c "SELECT 1"
```

### Issue: Program deployment failed

**Solution:** Ensure you have enough SOL:
```bash
solana balance --url devnet
solana airdrop 2 --url devnet
```

### Issue: ngrok tunnel closed

**Solution:** Restart ngrok:
```bash
ngrok http 3000
# Update .env.development with new URL
```

### Issue: API returns 500 error

**Solution:** Check database tables exist:
```bash
# Run migrations or restart server to auto-create tables
NODE_ENV=production npm start
```

## Cleanup

### Stop All Services

```bash
# Find processes
ps aux | grep "npm\|ngrok"

# Kill processes
kill <PID>

# Or if using the script output
kill <SERVER_PID> <NGROK_PID>
```

### Drop Database Tables (if needed)

```bash
psql 'postgresql://...' -c "DROP TABLE IF EXISTS claims CASCADE; DROP TABLE IF EXISTS users CASCADE;"
```

## Next Steps

1. **Add SOL to test user** - Use Solana faucet
2. **Test claim flow end-to-end** - Generate proof → Claim on-chain
3. **Configure Alchemy webhook** - Get real-time NFT activity
4. **Test metadata serving** - Verify wallets can see NFT metadata
5. **Monitor database** - Ensure claims are being recorded

## Production Migration

When ready for production:
1. Deploy to Solana Mainnet
2. Update `DATABASE_URL` to production PostgreSQL
3. Change `SOLANA_RPC_URL` to mainnet RPC
4. Use proper domain instead of ngrok
5. Update `API_KEY` and signing keys
6. Enable SSL/HTTPS
7. Set up proper monitoring and logging

## Support

- GitHub Issues: https://github.com/Fight-Foundation/NFT-Tickets/issues
- Documentation: See `PARTNER_INTEGRATION.md` and `API_DOCUMENTATION.md`
- Email: alex@ksso.net
