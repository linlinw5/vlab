import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getUserByEmail, getUserById, updateOwnPassword } from "../db/queries";
import { authenticate, JwtPayload } from "../middleware/auth";
import { config } from "../config";
import { logDebug, logError } from "../lib/logger";

const router = Router();

function signTokens(payload: JwtPayload) {
  const accessToken = jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

function setTokenCookies(res: Response, accessToken: string, refreshToken: string) {
  const isProd = config.nodeEnv === "production";

  res.cookie("access_token", accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: config.jwt.accessExpiresIn * 1000,
    path: "/",
  });

  res.cookie("refresh_token", refreshToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    maxAge: config.jwt.refreshExpiresIn * 1000,
    path: "/api/auth/refresh",
  });
}

// POST /api/auth/login
router.post("/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  logDebug("routes", "auth_login", { message: "Request received", email });
  if (!email || !password) {
    logError("routes", "auth_login", { message: "Email and password are required", email: email ?? null });
    res.status(400).json({ message: "Email and password are required" });
    return;
  }

  const user = await getUserByEmail(email);
  if (!user) {
    logError("routes", "auth_login", { message: "Invalid credentials", email });
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    logError("routes", "auth_login", { message: "Invalid credentials", email, userId: user.id });
    res.status(401).json({ message: "Invalid credentials" });
    return;
  }

  const payload: JwtPayload = { userId: user.id, roleId: user.role_id, email: user.email, groupId: user.group_id };
  const { accessToken, refreshToken } = signTokens(payload);
  setTokenCookies(res, accessToken, refreshToken);

  const { password: _, ...safeUser } = user;
  logDebug("routes", "auth_login", { message: "Done", userId: user.id, email: user.email });
  res.json({ user: safeUser });
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  logDebug("routes", "auth_logout", { message: "Request received" });
  res.clearCookie("access_token", { path: "/" });
  res.clearCookie("refresh_token", { path: "/api/auth/refresh" });
  logDebug("routes", "auth_logout", { message: "Done" });
  res.json({ message: "Logged out" });
});

// POST /api/auth/refresh
router.post("/refresh", (req: Request, res: Response) => {
  logDebug("routes", "auth_refresh", { message: "Request received" });
  const token = req.cookies?.refresh_token;
  if (!token) {
    logError("routes", "auth_refresh", { message: "No refresh token" });
    res.status(401).json({ message: "No refresh token" });
    return;
  }
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
    const newPayload: JwtPayload = { userId: payload.userId, roleId: payload.roleId, email: payload.email, groupId: payload.groupId };
    const { accessToken, refreshToken } = signTokens(newPayload);
    setTokenCookies(res, accessToken, refreshToken);
    logDebug("routes", "auth_refresh", { message: "Done", userId: payload.userId, email: payload.email });
    res.json({ message: "Token refreshed" });
  } catch (err) {
    res.clearCookie("access_token", { path: "/" });
    res.clearCookie("refresh_token", { path: "/api/auth/refresh" });
    logError("routes", "auth_refresh", {
      message: err instanceof Error ? err.message : "Invalid refresh token",
    });
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// PATCH /api/auth/password — change own password
router.patch("/password", authenticate, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  logDebug("routes", "auth_password_change", { message: "Request received", userId: req.user!.userId, email: req.user!.email });
  if (!currentPassword || !newPassword) {
    logError("routes", "auth_password_change", { message: "currentPassword and newPassword are required", userId: req.user!.userId });
    res.status(400).json({ message: "currentPassword and newPassword are required" });
    return;
  }

  const user = await getUserByEmail(req.user!.email);
  if (!user) {
    logError("routes", "auth_password_change", { message: "User not found", userId: req.user!.userId, email: req.user!.email });
    res.status(404).json({ message: "User not found" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    logError("routes", "auth_password_change", { message: "Current password is incorrect", userId: req.user!.userId });
    res.status(400).json({ message: "Current password is incorrect" });
    return;
  }

  await updateOwnPassword(req.user!.userId, newPassword);
  logDebug("routes", "auth_password_change", { message: "Done", userId: req.user!.userId });
  res.json({ message: "Password changed" });
});

// GET /api/auth/me
router.get("/me", authenticate, async (req: Request, res: Response) => {
  logDebug("routes", "auth_me", { message: "Request received", userId: req.user!.userId });
  const user = await getUserById(req.user!.userId);
  if (!user) {
    logError("routes", "auth_me", { message: "User not found", userId: req.user!.userId });
    res.status(404).json({ message: "User not found" });
    return;
  }
  logDebug("routes", "auth_me", { message: "Done", userId: req.user!.userId });
  res.json(user);
});

export default router;
