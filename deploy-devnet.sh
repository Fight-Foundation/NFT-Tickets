#!/bin/bash
set -e

echo "🚀 Fight Tickets NFT - Devnet Deployment Script"
echo "================================================"
echo ""

# Check if .env.development exists
if [ ! -f .env.development ]; then
    echo "❌ Error: .env.development not found"
    exit 1
fi

# Load environment variables manually to avoid issues with special characters
while IFS='=' read -r key value; do
    # Skip empty lines and comments
    [[ -z "$key" || "$key" =~ ^#.* ]] && continue
    # Remove quotes if present
    value="${value%\"}"
    value="${value#\"}"
    export "$key=$value"
done < .env.development

echo "📋 Pre-deployment Checklist:"
echo "  ✓ Database: ${DATABASE_URL:0:50}..."
echo "  ✓ Solana RPC: $SOLANA_RPC_URL"
echo "  ✓ Node Environment: $NODE_ENV"
echo ""

# Step 1: Build smart contract
echo "🔨 Step 1: Building smart contract..."
cd fight_tickets_nft
anchor build
echo "✅ Smart contract built"
echo ""

# Step 2: Deploy to devnet
echo "🚀 Step 2: Deploying to Solana Devnet..."
solana config set --url devnet
solana config get
echo ""
echo "Checking deployer balance..."
solana balance
echo ""
anchor deploy --provider.cluster devnet
PROGRAM_ID=$(solana address -k target/deploy/fight_tickets_nft-keypair.json)
echo "✅ Program deployed: $PROGRAM_ID"
echo ""

# Step 3: Update environment with program ID
echo "📝 Step 3: Updating .env.development with program ID..."
cd ..
sed -i "s|NFT_CONTRACT_ADDRESS=.*|NFT_CONTRACT_ADDRESS=$PROGRAM_ID|" .env.development
echo "✅ Environment updated"
echo ""

# Step 4: Initialize the contract
echo "🎯 Step 4: Initializing NFT collection..."
cd fight_tickets_nft
npm run init-collection
echo "✅ Collection initialized"
echo ""

# Step 5: Start API server
echo "🌐 Step 5: Starting API server..."
cd ..
echo "Starting server with production database..."
NODE_ENV=production npm start &
SERVER_PID=$!
echo "✅ API server started (PID: $SERVER_PID)"
echo ""

# Step 6: Start ngrok
echo "🔗 Step 6: Starting ngrok tunnel..."
ngrok http 3000 > /dev/null &
NGROK_PID=$!
sleep 3

# Get ngrok URL
NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4)
echo "✅ Ngrok tunnel active: $NGROK_URL"
echo ""

# Update environment with ngrok URL
sed -i "s|API_BASE_URL=.*|API_BASE_URL=$NGROK_URL|" .env.development
sed -i "s|BASE_URI=.*|BASE_URI=$NGROK_URL/metadata|" .env.development

echo "================================================"
echo "✅ Deployment Complete!"
echo "================================================"
echo ""
echo "📊 Deployment Summary:"
echo "  Program ID: $PROGRAM_ID"
echo "  API URL: $NGROK_URL"
echo "  Metadata: $NGROK_URL/metadata/{id}.json"
echo "  Health: $NGROK_URL/health"
echo ""
echo "🧪 Test User:"
echo "  Public Key: $(solana-keygen pubkey test-user.json)"
echo "  Get SOL: https://faucet.solana.com/"
echo ""
echo "📝 Next Steps:"
echo "  1. Fund test user: solana airdrop 2 \$(solana-keygen pubkey test-user.json) --url devnet"
echo "  2. Test claim generation: curl $NGROK_URL/health"
echo "  3. Configure Alchemy webhook: $NGROK_URL/api/webhook/alchemy"
echo ""
echo "🛑 To stop:"
echo "  kill $SERVER_PID $NGROK_PID"
echo ""
