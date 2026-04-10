import { Router } from "express";
import { config } from "../config";

const router = Router();

// 公开接口，无需鉴权，返回前端可用的 console 代理选项
router.get("/", (_req, res) => {
  const proxies: { label: string; port: number }[] = [];

  if (config.builtinProxy.enabled) {
    proxies.push({ label: config.builtinProxy.label, port: config.builtinProxy.port });
  }

  if (config.nginxProxy.enabled) {
    proxies.push({ label: config.nginxProxy.label, port: config.nginxProxy.port });
  }

  res.json({ consoleProxies: proxies });
});

export default router;
