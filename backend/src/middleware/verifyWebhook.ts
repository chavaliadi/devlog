import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export interface AuthenticatedRequest extends Request {
  rawBody?: Buffer;
}

export const verifyGitHubWebhook = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers['x-hub-signature-256'] as string;
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Webhook] GITHUB_WEBHOOK_SECRET is not configured.');
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  if (!signature) {
    console.warn('[Webhook] Request missing x-hub-signature-256 header.');
    res.status(401).json({ error: 'Missing signature header' });
    return;
  }

  if (!req.rawBody) {
    console.warn('[Webhook] Request missing rawBody buffer for verification.');
    res.status(400).json({ error: 'Missing raw request body' });
    return;
  }

  // Calculate HMAC signature
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(req.rawBody);
  const calculatedSignature = `sha256=${hmac.digest('hex')}`;

  // Timing-safe comparison to prevent timing attacks
  try {
    const sigBuffer = Buffer.from(signature);
    const calcBuffer = Buffer.from(calculatedSignature);

    if (sigBuffer.length !== calcBuffer.length) {
      console.warn('[Webhook] Invalid HMAC signature length.');
      res.status(403).json({ error: 'Invalid HMAC signature' });
      return;
    }

    const isSignatureValid = crypto.timingSafeEqual(sigBuffer, calcBuffer);

    if (!isSignatureValid) {
      console.warn('[Webhook] Invalid HMAC signature detected.');
      res.status(403).json({ error: 'Invalid HMAC signature' });
      return;
    }

    // Signature matches, proceed
    console.log('[Webhook] HMAC signature verified successfully.');
    next();
  } catch (error) {
    console.error('[Webhook] Error during signature verification:', error);
    res.status(403).json({ error: 'Signature verification failed' });
  }
};
