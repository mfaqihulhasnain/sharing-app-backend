import { ZodError } from "zod";
import ApiError from "../utils/ApiError.js";

// Purpose: wrap zod schemas in reusable request-validation middleware.
const validate = (schema) => (req, _res, next) => {
  try {
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
      headers: req.headers,
    });

    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query;
    if (parsed.params !== undefined) req.params = parsed.params;

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      }));

      const firstError = details[0];
      const message = firstError
        ? `Invalid request: ${firstError.path || "input"} ${firstError.message}`
        : "Invalid request payload";

      const apiError = new ApiError(400, message);
      apiError.details = details;
      return next(apiError);
    }

    return next(error);
  }
};

export default validate;
