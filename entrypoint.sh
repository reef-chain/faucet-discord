#!/bin/bash
sed -i "s/REPLACE_MNEMONIC/$MNEMONIC/g" ./dist/app.js
sed -i "s/REPLACE_DISCORD_TOKEN/$DISCORD_TOKEN/g" ./dist/app.js
sed -i "s/REPLACE_DISCORD_CLIENT_ID/$DISCORD_CLIENT_ID/g" ./dist/app.js
sed -i "s/REPLACE_RPC_WSS/$RPC_WSS/g" ./dist/app.js
yarn start
