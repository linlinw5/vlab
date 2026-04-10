import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { initDatabase, syncDefaultGroupTag } from "./db/init";
import apiRouter from "./routes";
import { startBuiltinProxy } from "./services/proxy";
import { initVCenterCategory, getDefaultGroupTagId } from "./services/vcenter";
import { camelcaseResponse } from "./middleware/camelcase-response";
import { logError, logInfo } from "./lib/logger";

const app = express();

app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(camelcaseResponse);

// Trust proxy headers when behind nginx
app.set("trust proxy", 1);

app.use("/api", apiRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

// 全局 error handler — catches any error thrown in async route handlers
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logError("server", "unhandled_route_error", { message: err.message });
  res.status(500).json({ message: err.message || "Internal server error" });
});

async function main() {
  await initDatabase();
  await initVCenterCategory();
  await syncDefaultGroupTag(getDefaultGroupTagId());

  app.listen(config.port, () => {
    logInfo("server", "api_listening", { port: config.port });
  });

  if (config.builtinProxy.enabled) {
    startBuiltinProxy();
  } else {
    logInfo("server", "builtin_proxy_disabled");
  }
}

main().catch((err) => {
  logError("server", "startup_failed", {
    message: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
