// Invoke 'strict' JavaScript mode
"use strict";
if (!process.env.NODE_ENV) {
    throw new Error('"NODE_ENV" ENV VALUE NOT SET');
}
// Load the correct configuration file according to the 'NODE_ENV' variable
module.exports = require("./env/" + process.env.NODE_ENV + ".js");
