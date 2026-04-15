const rateLimit = require("express-rate-limit");

// Purpose: provide a single rate-limit policy that can be tuned by environment.
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
});

module.exports = rateLimiter;
