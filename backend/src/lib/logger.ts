import { config } from "../config";

const DEBUG_SCOPES = ["server", "db", "vmware", "asa", "proxy", "auth", "cron", "routes"] as const;

export type DebugScope = (typeof DEBUG_SCOPES)[number];

const colors = {
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  reset: "\x1b[0m",
} as const;

function isDebugEnabled(): boolean {
  return config.nodeEnv === "development";
}

function now(): string {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function emit(method: "log" | "warn" | "error", color: string, scope: DebugScope, event: string, details: Record<string, unknown>): void {
  const payload = {
    time: now(),
    ...details,
  };
  console[method](`${color}[${scope}]${colors.reset} ${event} ${JSON.stringify(payload)}`);
}

export function logDebug(scope: DebugScope, event: string, details: Record<string, unknown> = {}): void {
  if (!isDebugEnabled()) return;
  emit("log", colors.blue, scope, event, details);
}

export function logInfo(scope: DebugScope, event: string, details: Record<string, unknown> = {}): void {
  emit("log", colors.green, scope, event, details);
}

export function logWarn(scope: DebugScope, event: string, details: Record<string, unknown> = {}): void {
  emit("warn", colors.yellow, scope, event, details);
}

export function logError(scope: DebugScope, event: string, details: Record<string, unknown> = {}): void {
  emit("error", colors.red, scope, event, details);
}
