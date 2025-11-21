#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🎯 Initializing NFT Collection on Devnet${NC}"

# Load environment
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=/home/alex/.config/solana/id.json

# Read signing public key from .env.development
SIGNING_PUBLIC_KEY=$(grep SIGNING_PUBLIC_KEY /home/alex/fight-ticket/.env.development | cut -d'=' -f2)

echo "Program ID: 6mfzKkngeptJoiVH7oYdSPSxnNpt3dBs94CMNkfw5oyG"
echo "Operator: $(solana address)"
echo "API Signer: $SIGNING_PUBLIC_KEY"
echo "Base URI: https://ticketsnft.fight.foundation/metadata"

# Run anchor test but only the initialize test
npx anchor test --skip-deploy --skip-build --skip-local-validator --provider.cluster devnet -- --grep "Initialize collection"

echo -e "${GREEN}✅ Collection initialized successfully!${NC}"
