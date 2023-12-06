// Invoke 'strict' JavaScript mode
"use strict";
if (!process.env.NODE_ENV) {
    throw new Error('"NODE_ENV" ENV VALUE NOT SET');
}

if (process.env.NODE_ENV === 'production' && (!process.env.DISCORD_TOKEN || !process.env.MNEMONIC || !process.env.DISCORD_CLIENT_ID || !process.env.RPC_WSS)) {
    throw new Error('"DISCORD_TOKEN" || "MNEMONIC" || "DISCORD_CLIENT_ID" || "RPC_WSS" ENV VALUE NOT SET');
}
// Load the correct configuration file according to the 'NODE_ENV' variable
module.exports = require("./env/" + process.env.NODE_ENV + ".js");
