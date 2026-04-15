const ApiError = require("../utils/ApiError");

// Purpose: forward unmatched routes into the global error flow.
const notFound = (_req, _res, next) => {
  next(new ApiError(404, "Route not found"));
};

module.exports = notFound;
