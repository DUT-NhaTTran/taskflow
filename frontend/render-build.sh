#!/bin/bash

# Set memory limit for Node.js
export NODE_OPTIONS="--max-old-space-size=400"

# Install dependencies with limited cache
npm ci --prefer-offline --no-audit --no-fund

# Build the application
npm run build

echo "Build completed successfully!" 