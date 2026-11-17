import { randomUUID } from 'node:crypto';
import { del, get, put } from '@vercel/blob';
import {
  MAX_QUESTION_IMAGE_BYTES,
  MAX_QUESTION_IMAGES
} from '../src/app/core/models/question.model.js';

const imagePathPrefix = 'question-images/';
const imageUrlPrefix = '/api/question-images?id=';
const imageCacheMaxAgeSeconds = 31_536_000;

type SupportedImageType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface QuestionImageUpload {
  contentType: SupportedImageType;
  data: Buffer;
}

export interface UploadedQuestionImages {
  ids: string[];
  urls: string[];
}

export function parseQuestionImageUploads(value: unknown): QuestionImageUpload[] | null {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.length > MAX_QUESTION_IMAGES) {
    return null;
  }

  const uploads: QuestionImageUpload[] = [];
  let totalBytes = 0;

  for (const item of value) {
    if (typeof item !== 'string') {
      return null;
    }

    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(item);
    if (!match) {
      return null;
    }

    const contentType = match[1];
    const base64 = match[2];
    if (
      (contentType !== 'image/jpeg' &&
        contentType !== 'image/png' &&
        contentType !== 'image/webp') ||
      typeof base64 !== 'string'
    ) {
      return null;
    }

    const data = Buffer.from(base64, 'base64');
    if (
      !data.length ||
      data.toString('base64') !== base64 ||
      !matchesImageType(data, contentType)
    ) {
      return null;
    }

    totalBytes += data.length;
    if (totalBytes > MAX_QUESTION_IMAGE_BYTES) {
      return null;
    }

    uploads.push({ contentType, data });
  }

  return uploads;
}

export async function uploadQuestionImages(
  uploads: QuestionImageUpload[]
): Promise<UploadedQuestionImages> {
  const ids: string[] = [];

  try {
    for (const upload of uploads) {
      const id = randomUUID();
      await put(getQuestionImagePath(id), upload.data, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: imageCacheMaxAgeSeconds,
        contentType: upload.contentType
      });
      ids.push(id);
    }
  } catch (error) {
    try {
      await deleteQuestionImages(ids);
    } catch (cleanupError) {
      console.error('Unable to clean up uploaded question images:', cleanupError);
    }

    throw error;
  }

  return {
    ids,
    urls: ids.map((id) => `${imageUrlPrefix}${id}`)
  };
}

export async function getQuestionImage(id: string) {
  return get(getQuestionImagePath(id), { access: 'private' });
}

export async function deleteQuestionImages(ids: string[]): Promise<void> {
  if (ids.length) {
    await del(ids.map(getQuestionImagePath));
  }
}

export function questionImageIdFromUrl(url: string): string | null {
  const match = /^\/api\/question-images\?id=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(
    url
  );
  return match?.[1] ?? null;
}

function getQuestionImagePath(id: string): string {
  return `${imagePathPrefix}${id}`;
}

function matchesImageType(data: Buffer, contentType: SupportedImageType): boolean {
  if (contentType === 'image/jpeg') {
    return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  }

  if (contentType === 'image/png') {
    return data.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
  }

  return (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  );
}
