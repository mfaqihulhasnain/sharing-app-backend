// Purpose: represent operational API errors with an attached HTTP status code.
class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.statusCode = statusCode;
    if (code) {
      this.code = code;
    }
  }
}

export default ApiError;
