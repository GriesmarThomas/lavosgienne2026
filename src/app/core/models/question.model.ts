export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'open' | 'qcm' | 'image';
export type QuizDifficulty = QuestionDifficulty | 'random';

export const MAX_QUESTION_IMAGES = 8;
export const MAX_QUESTION_IMAGE_BYTES = 3 * 1024 * 1024;

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

export function getQuestionImages(question: Pick<Question, 'image' | 'images'>): string[] {
  if (question.images?.length) {
    return question.images;
  }

  return question.image ? [question.image] : [];
}

export const APP_TITLE = 'La Vosgienne 2026';
