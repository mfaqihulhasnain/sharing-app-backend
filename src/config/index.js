import { env } from "./env.js";
import { connectDatabase, disconnectDatabase } from "./db.js";

// Purpose: expose shared config entrypoints from one place.
export { env, connectDatabase, disconnectDatabase };
