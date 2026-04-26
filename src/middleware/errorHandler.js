// Purpose: format uncaught errors into a consistent API response shape.
const errorHandler = (error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  const response = {
    success: false,
    message: error.message || "Internal Server Error",
  };

  if (error.code) {
    response.code = error.code;
  }

  if (error.details) {
    response.details = error.details;
  }

  if (process.env.NODE_ENV !== "production" && error.stack) {
    response.stack = error.stack;
  }

  res.status(statusCode).json(response);
};

export default errorHandler;
