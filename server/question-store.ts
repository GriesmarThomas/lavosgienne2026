import { get, put } from '@vercel/blob';
import {
  hasExactlyOneCorrectChoice,
  type Question
} from '../src/app/core/models/question.model.js';
import questionsData from '../src/assets/questions/questions.json' with { type: 'json' };

const questionBankPath = 'questions.json';
const blobCacheMaxAgeSeconds = 60;

export interface QuestionBankSnapshot {
  questions: Question[];
  etag: string;
}

const difficulties = ['easy', 'medium', 'hard'];
const questionTypes = ['open', 'qcm', 'image'];

export function parseQuestion(value: unknown): Question | null {
  if (!isRecord(value)) {
    return null;
  }

  const { id, category, difficulty, type, question, correctAnswer } = value;
  if (
    !Number.isInteger(id) ||
    typeof id !== 'number' ||
    id < 1 ||
    typeof category !== 'string' ||
    !category.trim() ||
    typeof difficulty !== 'string' ||
    !difficulties.includes(difficulty) ||
    typeof type !== 'string' ||
    !questionTypes.includes(type) ||
    typeof question !== 'string' ||
    !question.trim() ||
    typeof correctAnswer !== 'string' ||
    !correctAnswer.trim()
  ) {
    return null;
  }

  const acceptedAnswers = parseStringArray(value.acceptedAnswers);
  const choices = parseStringArray(value.choices);
  const images = parseStringArray(value.images);
  if (
    acceptedAnswers === null ||
    choices === null ||
    images === null ||
    (type === 'qcm' && !choices.length)
  ) {
    return null;
  }

  const parsed: Question = {
    id,
    category: category.trim(),
    difficulty: difficulty as Question['difficulty'],
    type: type as Question['type'],
    question: question.trim(),
    correctAnswer: correctAnswer.trim()
  };

  if (acceptedAnswers.length) {
    parsed.acceptedAnswers = acceptedAnswers;
  }

  if (choices.length) {
    parsed.choices = choices;
  }

  if (images.length) {
    parsed.images = images;
  }

  if (typeof value.image === 'string' && value.image.trim()) {
    parsed.image = value.image.trim();
  }

  if (typeof value.anecdote === 'string' && value.anecdote.trim()) {
    parsed.anecdote = value.anecdote.trim();
  }

  return parsed;
}

export async function loadQuestions(): Promise<Question[]> {
  return (await loadQuestionBank()).questions;
}

export async function loadQuestionBank(): Promise<QuestionBankSnapshot> {
  let stored = await get(questionBankPath, { access: 'private', useCache: false });

  if (!stored) {
    const seedQuestions = parseQuestionList(questionsData);
    if (!seedQuestions) {
      throw new Error('The bundled question bank contains invalid question data.');
    }

    await put(questionBankPath, JSON.stringify(seedQuestions, null, 2), {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: blobCacheMaxAgeSeconds,
      contentType: 'application/json; charset=utf-8'
    });
    stored = await get(questionBankPath, { access: 'private', useCache: false });
    if (!stored) {
      throw new Error('The question bank could not be initialized in Blob storage.');
    }
  }

  if (stored.statusCode !== 200 || !stored.stream) {
    throw new Error('The question bank could not be read from Blob storage.');
  }

  const content = await new Response(stored.stream).text();
  let value: unknown;

  try {
    value = JSON.parse(content) as unknown;
  } catch (error) {
    throw new Error('The stored question bank is not valid JSON.', { cause: error });
  }

  const questions = parseQuestionList(value);
  if (!questions) {
    throw new Error('The stored question bank contains invalid question data.');
  }

  return { questions, etag: getStrongEtag(stored.blob.etag) };
}

export async function saveQuestions(questions: Question[], etag: string): Promise<void> {
  await put(questionBankPath, JSON.stringify(questions, null, 2), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: blobCacheMaxAgeSeconds,
    ifMatch: etag,
    contentType: 'application/json; charset=utf-8'
  });
}

export function parseRequestBody(body: unknown): Record<string, unknown> | null {
  let value = body;

  if (typeof body === 'string') {
    try {
      value = JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }

  return isRecord(value) ? value : null;
}

function parseQuestionList(value: unknown): Question[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const questions = value.map(parseQuestion);
  if (questions.some((question) => question === null)) {
    return null;
  }

  const parsedQuestions = questions.filter((question): question is Question => question !== null);
  if (parsedQuestions.length !== questions.length) {
    return null;
  }

  return new Set(parsedQuestions.map((question) => question.id)).size === parsedQuestions.length
    ? parsedQuestions
    : null;
}

function parseStringArray(value: unknown): string[] | null {
  if (value === undefined) {
    return [];
  }

  if (
    !Array.isArray(value) ||
    !value.every((item: unknown): item is string => typeof item === 'string')
  ) {
    return null;
  }

  return value.map((item) => item.trim()).filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getStrongEtag(etag: string): string {
  return etag.startsWith('W/') ? etag.slice(2) : etag;
}
