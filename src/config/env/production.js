"use strict";

module.exports = {
    token: process.env.DISCORD_TOKEN,
    prefix: '/',
    symbol: 'REEF',
    decimals: 18,
    ws: process.env.RPC_WSS,
    address_type: 42,
    mnemonic: process.env.MNEMONIC,
    amount: 2000,
    limit: 12,
    clientId:process.env.DISCORD_CLIENT_ID
};
