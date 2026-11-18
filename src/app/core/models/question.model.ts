export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'open' | 'qcm' | 'image';
export type QuizDifficulty = QuestionDifficulty | 'random';

export const MAX_QUESTION_IMAGES = 8;
export const MAX_QUESTION_IMAGE_BYTES = 3 * 1024 * 1024;

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

export function getCategoryIcon(category: string): string {
  const normalizedCategory = category
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase();

  return CATEGORY_ICONS[normalizedCategory] ?? '🏷️';
}

export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '');
}

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
