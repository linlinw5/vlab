import https from "https";
import type { Socket } from "net";
import fs from "fs";
import { createProxyMiddleware } from "http-proxy-middleware";
import { config } from "../../config";
import { logError, logInfo, logWarn } from "../../lib/logger";

/**
 * Standalone HTTPS WebSocket proxy for VM console access.
 *
 * URL convention:
 *   wss://<proxy>:<port>/esxi/<esxi-host:port>/<remaining-path>
 */
export function startBuiltinProxy(): void {
  if (!fs.existsSync(config.builtinProxy.sslKeyPath) || !fs.existsSync(config.builtinProxy.sslCertPath)) {
    logWarn("proxy", "cert_files_missing", {
      sslKeyPath: config.builtinProxy.sslKeyPath,
      sslCertPath: config.builtinProxy.sslCertPath,
    });
    return;
  }

  const esxiProxy = createProxyMiddleware({
    changeOrigin: true,
    secure: false,
    ws: true,
    router: (req) => {
      const parts = (req.url || "").split("/").filter(Boolean);
      return `wss://${parts[1]}`;
    },
    pathRewrite: (path) => {
      const parts = path.split("/").filter(Boolean);
      return "/" + parts.slice(2).join("/");
    },
    on: {
      error: (err) => {
        const msg = (err as Error).message;
        if (msg.includes("timeout") || msg.includes("ECONNRESET")) return;
        logError("proxy", "esxi_ws_error", { message: msg });
      },
    },
  });

  const server = https.createServer(
    {
      key: fs.readFileSync(config.builtinProxy.sslKeyPath),
      cert: fs.readFileSync(config.builtinProxy.sslCertPath),
    },
    (req, res) => {
      // This endpoint is intentionally informational for browser access.
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          service: "vm-console-proxy",
          message: "This endpoint is for VM console WebSocket proxying.",
        }),
      );
    },
  );

  server.on("upgrade", (req, socket, head) => {
    const parts = (req.url || "").split("/").filter(Boolean);
    if (parts[0] === "esxi" && parts[1]) {
      esxiProxy.upgrade!(req, socket as Socket, head);
    } else {
      socket.destroy();
    }
  });

  server.listen(config.builtinProxy.port, () => {
    logInfo("proxy", "builtin_proxy_listening", { port: config.builtinProxy.port });
  });
}
