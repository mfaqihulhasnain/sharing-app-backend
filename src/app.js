const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./routes");
const rateLimiter = require("./middleware/rateLimiter");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { env } = require("./config");

// Purpose: configure the Express app, shared middleware, and API route mounting.
const app = express();

app.set("port", env.PORT);
app.use(helmet());
app.use(cors());
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(rateLimiter);
app.use("/api/v1", routes);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
