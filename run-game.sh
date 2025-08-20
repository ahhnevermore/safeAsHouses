#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Safe As Houses Game ===${NC}\n"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}Node.js is not installed! Please install Node.js v16 or higher.${NC}"
    exit 1
fi

# Install dependencies if needed
echo -e "${GREEN}Installing dependencies...${NC}"
npm install

# Build TypeScript
echo -e "\n${GREEN}Building TypeScript...${NC}"
npm run build

# Run the server
echo -e "\n${GREEN}Starting the game server...${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}\n"
npm start
