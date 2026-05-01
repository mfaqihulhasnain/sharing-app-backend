import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes/index.js";
import rateLimiter from "./middleware/rateLimiter.js";
import notFound from "./middleware/notFound.js";
import errorHandler from "./middleware/errorHandler.js";
import { env } from "./config/index.js";

// Purpose: configure the Express app, shared middleware, and API route mounting.
const app = express();
const configuredOrigins = env.CLIENT_ORIGIN
  ? env.CLIENT_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean)
  : [];
const fallbackCorsOrigin = env.NODE_ENV === "production" ? false : true;

app.set("port", env.PORT);
app.set("trust proxy", env.TRUST_PROXY);
app.use(helmet());
app.use(
  cors({
    origin: configuredOrigins.length ? configuredOrigins : fallbackCorsOrigin,
    credentials: true,
  })
);
app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json());
app.use(rateLimiter);
app.use("/api/v1", routes);
app.use(notFound);
app.use(errorHandler);

export default app;
