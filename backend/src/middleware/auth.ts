import { Request, Response, NextFunction } from 'express';
import { PrismaClient, User } from '@prisma/client';

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: User;
  session?: any;
}

/**
 * Middleware that secures routes by ensuring a valid userId is stored in the cookie-session.
 * If verified, attaches the database User object to the Request for downstream handlers.
 */
export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userId = req.session?.userId;

  if (!userId) {
    res.status(401).json({ success: false, error: 'Unauthorized: Access is denied.' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      // Clear invalid session
      req.session = null;
      res.status(401).json({ success: false, error: 'Unauthorized: User not found.' });
      return;
    }

    req.user = user;
    next();
  } catch (error: any) {
    console.error('[Auth Middleware] Error validating session:', error.message);
    res.status(500).json({ success: false, error: 'Internal auth validation failure' });
  }
};
