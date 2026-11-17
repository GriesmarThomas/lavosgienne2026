import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadQuestions } from '../server/question-store.js';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');

  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  }

  try {
    const questions = await loadQuestions();
    return response.status(200).json(questions);
  } catch (error) {
    console.error('Unable to load quiz questions:', error);
    return response.status(500).json({ error: 'Impossible de charger les questions.' });
  }
}
