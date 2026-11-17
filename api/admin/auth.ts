import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  clearAdminSession,
  hasSameOrigin,
  isAdminConfigured,
  isAuthenticated,
  matchesAdminCredentials,
  setAdminSession
} from '../../server/admin-auth.js';
import { parseRequestBody } from '../../server/question-store.js';

export default function handler(
  request: VercelRequest,
  response: VercelResponse
): VercelResponse {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method === 'GET') {
    return response.status(200).json({ authenticated: isAuthenticated(request) });
  }

  if (!hasSameOrigin(request)) {
    return response.status(403).json({ error: 'Origine de requête invalide.' });
  }

  if (request.method === 'DELETE') {
    clearAdminSession(response);
    return response.status(200).json({ authenticated: false });
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'GET, POST, DELETE');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  }

  if (!isAdminConfigured()) {
    return response.status(503).json({ error: 'L’administration n’est pas encore configurée.' });
  }

  const body = parseRequestBody(request.body);
  const username = body?.username;
  const password = body?.password;

  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    username.length > 128 ||
    password.length > 1024 ||
    !matchesAdminCredentials(username, password)
  ) {
    return response.status(401).json({ error: 'Identifiants incorrects.' });
  }

  setAdminSession(response);
  return response.status(200).json({ authenticated: true });
}
