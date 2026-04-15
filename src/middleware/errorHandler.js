// Purpose: format uncaught errors into a consistent API response shape.
const errorHandler = (error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || "Internal Server Error",
  });
};

module.exports = errorHandler;
