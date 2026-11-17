export type QuestionDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'open' | 'qcm' | 'image';
export type QuizDifficulty = QuestionDifficulty | 'random';

export interface Question {
  id: number;
  category: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  acceptedAnswers?: string[];
  choices?: string[];
  image?: string;
  anecdote?: string;
}

export const APP_TITLE = 'La Vosgienne 2026';
