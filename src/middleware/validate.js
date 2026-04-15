// Purpose: wrap zod schemas in reusable request-validation middleware.
const validate = (_schema) => (_req, _res, next) => {
  // TODO: parse and attach validated request input before controller execution.
  next();
};

module.exports = validate;
