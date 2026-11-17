import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const sessionCookieName = 'la-vosgienne-admin';
const sessionDurationSeconds = 8 * 60 * 60;

export function isAdminConfigured(): boolean {
  return Boolean(
    process.env.ADMIN_USERNAME &&
    process.env.ADMIN_PASSWORD &&
    process.env.ADMIN_SESSION_SECRET
  );
}

export function isAuthenticated(request: VercelRequest): boolean {
  if (!isAdminConfigured()) {
    return false;
  }

  const token = request.cookies[sessionCookieName];
  if (!token) {
    return false;
  }

  const [expiresAt, signature, ...rest] = token.split('.');
  if (!expiresAt || !signature || rest.length || !/^\d+$/.test(expiresAt)) {
    return false;
  }

  const expiry = Number(expiresAt);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqual(signature, sign(expiresAt));
}

export function matchesAdminCredentials(username: string, password: string): boolean {
  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;

  return Boolean(
    configuredUsername &&
    configuredPassword &&
    safeEqual(username, configuredUsername) &&
    safeEqual(password, configuredPassword)
  );
}

export function setAdminSession(response: VercelResponse): void {
  const expiresAt = String(Math.floor(Date.now() / 1000) + sessionDurationSeconds);
  const token = `${expiresAt}.${sign(expiresAt)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secure}`
  );
}

export function clearAdminSession(response: VercelResponse): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`
  );
}

export function hasSameOrigin(request: VercelRequest): boolean {
  const origin = request.headers.origin;
  if (!origin) {
    return true;
  }

  const forwardedHost = request.headers['x-forwarded-host'];
  const hostHeader = forwardedHost ?? request.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;
  if (!host) {
    return false;
  }

  try {
    return new URL(origin).host.toLowerCase() === host.split(',')[0].trim().toLowerCase();
  } catch {
    return false;
  }
}

function sign(value: string): string {
  return createHmac('sha256', process.env.ADMIN_SESSION_SECRET as string)
    .update(value)
    .digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const leftHash = createHash('sha256').update(left).digest();
  const rightHash = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}
