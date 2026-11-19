export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'open' | 'qcm' | 'image';
export type QuizDifficulty = QuestionDifficulty | 'random';

const DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
  easy: 'Facile',
  medium: 'Moyen',
  hard: 'Difficile',
  random: 'Aléatoire'
};

export const MAX_QUESTION_IMAGES = 8;
export const MAX_QUESTION_IMAGE_BYTES = 3 * 1024 * 1024;

export interface QuestionCategory {
  key: string;
  name: string;
  count: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  cinema: '🎬',
  festivals: '🎪',
  football: '⚽',
  karlsruhe: '🏙️',
  lan: '🎮',
  photos: '📷',
  soirees: '🍻',
  sorties: '🎉',
  souvenirs: '💭',
  voyages: '✈️'
};

export interface Question {
  id: number;
  category: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
  choices?: string[];
  images?: string[];
  image?: string;
  anecdote?: string;
}

interface ParsedNumericAnswer {
  value: number;
  exponent: number;
  hasExponent: boolean;
}

export function getDifficultyLabel(difficulty: QuizDifficulty): string {
  return DIFFICULTY_LABELS[difficulty];
}

export function getCategoryIcon(category: string): string {
  return CATEGORY_ICONS[getCategoryKey(category)] ?? '🏷️';
}

export function getCategoryKey(category: string): string {
  const normalizedCategory = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('fr');

  return normalizedCategory === 'soiree' || normalizedCategory === 'soirees'
    ? 'soirees'
    : normalizedCategory;
}

export function resolveCategoryName(category: string, existingCategories: readonly string[] = []): string {
  const cleanedCategory = category.trim().replace(/\s+/g, ' ');
  const categoryKey = getCategoryKey(cleanedCategory);

  if (categoryKey === 'soirees') {
    return 'Soirées';
  }

  const existingCategory = existingCategories.find((existing) => getCategoryKey(existing) === categoryKey);
  return existingCategory ? existingCategory.trim().replace(/\s+/g, ' ') : cleanedCategory;
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

export function isAnswerCorrect(
  question: Pick<Question, 'question' | 'correctAnswer' | 'acceptedAnswers'>,
  answer: string
): boolean {
  const expected = parseNumericAnswer(question.correctAnswer);
  const acceptedAnswers = question.acceptedAnswers ?? [];

  if (!expected) {
    return [question.correctAnswer, ...acceptedAnswers].some(
      (acceptedAnswer) => normalizeAnswer(acceptedAnswer) === normalizeAnswer(answer)
    );
  }

  if (acceptedAnswers.some((acceptedAnswer) => normalizeAnswer(acceptedAnswer) === normalizeAnswer(answer))) {
    return true;
  }

  const actual = parseNumericAnswer(answer);
  if (!actual) {
    return false;
  }

  const absoluteTolerance = getAbsoluteTolerance(question.question);
  if (absoluteTolerance !== null) {
    return Math.abs(actual.value - expected.value) <= absoluteTolerance;
  }

  // Scientific-notation values use two decimal places unless the question specifies another precision.
  const decimalPlaces = getRequestedDecimalPlaces(question.question) ?? (expected.hasExponent ? 2 : null);
  if (decimalPlaces === null) {
    return actual.value === expected.value;
  }

  const coefficientScale = Math.pow(10, expected.exponent);
  const expectedCoefficient = expected.value / coefficientScale;
  const actualCoefficient = actual.value / coefficientScale;
  const precisionScale = Math.pow(10, decimalPlaces);
  const roundedExpected = Math.round(expectedCoefficient * precisionScale) / precisionScale;
  const halfStep = 0.5 / precisionScale;
  const floatingPointTolerance =
    Number.EPSILON * Math.max(1, Math.abs(actualCoefficient), Math.abs(expectedCoefficient)) * 4;

  return (
    actualCoefficient >= roundedExpected - halfStep - floatingPointTolerance &&
    actualCoefficient < roundedExpected + halfStep - floatingPointTolerance
  );
}

function parseNumericAnswer(value: string): ParsedNumericAnswer | null {
  const normalizedValue = value
    .replace(/10([⁺⁻]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, exponent: string) =>
      `10^${exponent.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]/g, (digit) => SUPERSCRIPT_DIGITS[digit])}`
    )
    .replace(/,/g, '.');
  const match = normalizedValue.match(
    /^\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*(?:×|x|\*)\s*10\^?([+-]?\d+)|\s*[eE]([+-]?\d+))?\s*(?:€|\$|euros?|dollars?)?\s*$/i
  );

  if (!match) {
    return null;
  }

  const coefficient = Number(match[1]);
  const exponent = Number(match[2] ?? match[3] ?? 0);
  const valueAsNumber = coefficient * Math.pow(10, exponent);
  if (!Number.isFinite(valueAsNumber)) {
    return null;
  }

  return {
    value: valueAsNumber,
    exponent,
    hasExponent: match[2] !== undefined || match[3] !== undefined
  };
}

function getAbsoluteTolerance(question: string): number | null {
  const normalizedQuestion = normalizeToleranceText(question);
  const match = normalizedQuestion.match(
    /\ba\s*(\d+(?:[.,]\d+)?)\s*(?:(?:€|\$|euros?|dollars?|unites?|points?|km|m|cm|mm|kg|g|l|ml|ans?)\s*)?(?:pres|pret)\b/
  );

  return match ? Number(match[1].replace(',', '.')) : null;
}

function getRequestedDecimalPlaces(question: string): number | null {
  const normalizedQuestion = normalizeToleranceText(question);
  const match = normalizedQuestion.match(
    /\ba\s+(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|\d+)\s+(?:decimales?|chiffres?\s+apres\s+(?:la\s+)?virgule)\s+(?:pres|pret)\b/
  );

  if (!match) {
    return null;
  }

  const decimalPlaces = DECIMAL_COUNT_WORDS[match[1]] ?? Number(match[1]);
  return Number.isInteger(decimalPlaces) && decimalPlaces >= 0 && decimalPlaces <= 12
    ? decimalPlaces
    : null;
}

function normalizeToleranceText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .replace(/[’']/g, ' ')
    .replace(/[^a-z0-9€$.,\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const DECIMAL_COUNT_WORDS: Record<string, number> = {
  un: 1,
  une: 1,
  deux: 2,
  trois: 3,
  quatre: 4,
  cinq: 5,
  six: 6,
  sept: 7,
  huit: 8,
  neuf: 9,
  dix: 10
};

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-'
};

export function hasExactlyOneCorrectChoice(
  question: Pick<Question, 'type' | 'correctAnswer' | 'choices' | 'acceptedAnswers'>
): boolean {
  if (question.type !== 'qcm') {
    return true;
  }

  const normalizedChoices = (question.choices ?? []).map(normalizeAnswer);
  const normalizedCorrectAnswer = normalizeAnswer(question.correctAnswer);

  return (
    normalizedChoices.length >= 2 &&
    normalizedChoices.every(Boolean) &&
    new Set(normalizedChoices).size === normalizedChoices.length &&
    normalizedChoices.filter((choice) => choice === normalizedCorrectAnswer).length === 1 &&
    !(question.acceptedAnswers?.length)
  );
}

export function getQuestionImages(question: Pick<Question, 'image' | 'images'>): string[] {
  if (question.images?.length) {
    return question.images;
  }

  return question.image ? [question.image] : [];
}

export const APP_TITLE = 'La Vosgienne 2026';
