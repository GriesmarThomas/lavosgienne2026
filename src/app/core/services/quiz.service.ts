import { Injectable } from '@angular/core';
import { Question, QuizDifficulty } from '../models/question.model';
import questionsData from '../../../assets/questions/questions.json';
import { Punishment, PunishmentService } from './punishment.service';

export interface QuizSession {
  questions: Question[];
  currentIndex: number;
  difficulty: QuizDifficulty;
  count: number;
  lastResult?: QuizResult;
}

export interface QuizResult {
  question: Question;
  selectedAnswer: string;
  isCorrect: boolean;
  punishment: Punishment | null;
  isComplete: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QuizService {
  private readonly sessionKey = 'la-vosgienne-session';
  private readonly configKey = 'la-vosgienne-config';
  private readonly questions: Question[] = Array.isArray(questionsData) ? (questionsData as Question[]) : [];

  constructor(private readonly punishmentService: PunishmentService) {}

  getAvailableDifficulties(): Array<QuizDifficulty> {
    return ['random', 'easy', 'medium', 'hard'];
  }

  getQuestionCountOptions(): number[] {
    return [5, 8, 10, 12];
  }

  getSavedConfig(): { difficulty: QuizDifficulty; questionCount: number } {
    const defaultValue = { difficulty: 'random' as QuizDifficulty, questionCount: 5 };

    if (typeof localStorage === 'undefined') {
      return defaultValue;
    }

    const rawValue = localStorage.getItem(this.configKey);

    if (!rawValue) {
      return defaultValue;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<{ difficulty: QuizDifficulty; questionCount: number }>;
      return {
        difficulty: parsed.difficulty ?? defaultValue.difficulty,
        questionCount: parsed.questionCount ?? defaultValue.questionCount
      };
    } catch {
      return defaultValue;
    }
  }

  saveConfig(difficulty: QuizDifficulty, questionCount: number): void {
    localStorage.setItem(this.configKey, JSON.stringify({ difficulty, questionCount }));
  }

  startSession(difficulty: QuizDifficulty, count: number): Question[] {
    const sessionQuestions = this.buildQuestionSet(difficulty, count);
    const session: QuizSession = {
      questions: sessionQuestions,
      currentIndex: 0,
      difficulty,
      count: sessionQuestions.length,
      lastResult: undefined
    };

    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    return sessionQuestions;
  }

  getSession(): QuizSession {
    const defaultSession: QuizSession = {
      questions: [],
      currentIndex: 0,
      difficulty: 'random',
      count: 0
    };

    if (typeof localStorage === 'undefined') {
      return defaultSession;
    }

    const rawValue = localStorage.getItem(this.sessionKey);

    if (!rawValue) {
      return defaultSession;
    }

    try {
      return JSON.parse(rawValue) as QuizSession;
    } catch {
      return defaultSession;
    }
  }

  getCurrentQuestion(): Question | null {
    const session = this.getSession();

    if (!session.questions.length || session.currentIndex >= session.questions.length) {
      return null;
    }

    return session.questions[session.currentIndex];
  }

  hasMoreQuestions(): boolean {
    const session = this.getSession();
    return session.currentIndex + 1 < session.questions.length;
  }

  submitAnswer(selectedAnswer: string): QuizResult {
    const session = this.getSession();
    const currentIndex = session.currentIndex;
    const currentQuestion = session.questions[currentIndex];

    if (!currentQuestion) {
      throw new Error('Aucune question disponible');
    }

    const acceptedAnswers = [currentQuestion.correctAnswer, ...(currentQuestion.acceptedAnswers ?? [])];
    const isCorrect = acceptedAnswers.some(
      (answer) => this.normalize(answer) === this.normalize(selectedAnswer)
    );
    const punishment = isCorrect ? null : this.punishmentService.generatePunishment();
    const result: QuizResult = {
      question: currentQuestion,
      selectedAnswer,
      isCorrect,
      punishment,
      isComplete: currentIndex >= session.questions.length - 1
    };

    session.lastResult = result;
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    return result;
  }

  advanceToNextQuestion(): Question | null {
    const session = this.getSession();

    if (session.currentIndex + 1 >= session.questions.length) {
      return null;
    }

    session.currentIndex += 1;
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    return session.questions[session.currentIndex];
  }

  getLastResult(): QuizResult | null {
    const session = this.getSession();
    return session.lastResult ?? null;
  }

  clearSession(): void {
    localStorage.removeItem(this.sessionKey);
  }

  private buildQuestionSet(difficulty: QuizDifficulty, count: number): Question[] {
    const filteredQuestions =
      difficulty === 'random'
        ? [...this.questions]
        : this.questions.filter((question) => question.difficulty === difficulty);

    const shuffledQuestions = [...filteredQuestions].sort(() => Math.random() - 0.5);
    return shuffledQuestions.slice(0, Math.min(count, shuffledQuestions.length));
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '');
  }
}
