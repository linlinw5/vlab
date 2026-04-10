import { Pool } from "pg";
import { config } from "../config";
import { logError } from "../lib/logger";

const pool = new Pool(config.db);

pool.on("error", (err) => {
  logError("db", "pool_unexpected_error", { message: err.message });
});

export default pool;
