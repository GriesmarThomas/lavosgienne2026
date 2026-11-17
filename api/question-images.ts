import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getQuestionImage } from '../server/question-images.js';

const imageIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
): Promise<VercelResponse> {
  if (request.method !== 'GET') {
    response.setHeader('Allow', 'GET');
    return response.status(405).json({ error: 'Méthode non autorisée.' });
  }

  const id = request.query.id;
  if (typeof id !== 'string' || !imageIdPattern.test(id)) {
    return response.status(400).json({ error: 'Identifiant de photo invalide.' });
  }

  try {
    const stored = await getQuestionImage(id);
    if (!stored || stored.statusCode !== 200 || !stored.stream) {
      return response.status(404).json({ error: 'Photo introuvable.' });
    }

    const image = Buffer.from(await new Response(stored.stream).arrayBuffer());
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    response.setHeader('Content-Type', stored.blob.contentType ?? 'application/octet-stream');
    response.setHeader('Content-Length', image.length);
    response.setHeader('ETag', stored.blob.etag);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    return response.status(200).send(image);
  } catch (error) {
    console.error('Unable to load question image:', error);
    return response.status(500).json({ error: 'Impossible de charger la photo.' });
  }
}
