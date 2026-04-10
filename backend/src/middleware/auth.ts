import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  userId: number;
  roleId: number;
  email: string;
  groupId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

function extractToken(req: Request): string | null {
  // httpOnly cookie takes priority
  if (req.cookies?.access_token) return req.cookies.access_token;
  // Fallback: Authorization header (useful for testing)
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ message: 'Authentication required' });
    return;
  }
  try {
    req.user = jwt.verify(token, config.jwt.accessSecret) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.roleId !== config.roles.admin) {
    res.status(403).json({ message: 'Admin access required' });
    return;
  }
  next();
}

export function requireAdvanced(req: Request, res: Response, next: NextFunction): void {
  const roleId = req.user?.roleId;
  if (roleId !== config.roles.admin && roleId !== config.roles.advanced) {
    res.status(403).json({ message: 'Advanced access required' });
    return;
  }
  next();
}
