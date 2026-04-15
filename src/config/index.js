const { env } = require("./env");
const { connectDatabase } = require("./db");

// Purpose: expose shared config entrypoints from one place.
module.exports = { env, connectDatabase };
