#!/bin/bash

echo "Cleaning up the project structure..."

# Remove the nested safeAsHouses directory
rm -rf safeAsHouses

# Clean the dist directory
rm -rf dist

# Compile TypeScript
npx tsc

# Run the server
node dist/gameserver.js
