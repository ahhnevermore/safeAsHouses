#!/bin/bash

# First, install dependencies if needed
npm install

# Compile TypeScript
npx tsc

# Run the server
node dist/gameserver.js
