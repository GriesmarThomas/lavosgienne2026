import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  getCategoryKey,
  normalizeAnswer,
  Question,
  QuestionCategory,
  QuizDifficulty,
  resolveCategoryName
} from '../models/question.model';
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

  constructor(
    private readonly punishmentService: PunishmentService,
    private readonly http: HttpClient
  ) {}

  getAvailableDifficulties(): Array<QuizDifficulty> {
    return ['random', 'easy', 'medium', 'hard'];
  }

  getQuestionCountOptions(): number[] {
    return [5, 8, 10, 12];
  }

  getSavedConfig(): { difficulty: QuizDifficulty; category: string | null; questionCount: number } {
    const defaultValue = { difficulty: 'random' as QuizDifficulty, category: null, questionCount: 5 };
    const storage = this.getStorage();

    if (!storage) {
      return defaultValue;
    }

    const rawValue = storage.getItem(this.configKey);

    if (!rawValue) {
      return defaultValue;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<{
        difficulty: QuizDifficulty;
        category: string | null;
        questionCount: number;
      }>;
      const difficulty = this.isValidDifficulty(parsed.difficulty) ? parsed.difficulty : defaultValue.difficulty;
      const category = typeof parsed.category === 'string' && parsed.category.trim()
        ? resolveCategoryName(parsed.category)
        : null;
      const validQuestionCount = this.getQuestionCountOptions();
      const questionCount = typeof parsed.questionCount === 'number' && validQuestionCount.includes(parsed.questionCount)
        ? parsed.questionCount
        : defaultValue.questionCount;

      return { difficulty, category, questionCount };
    } catch {
      return defaultValue;
    }
  }

  saveConfig(difficulty: QuizDifficulty, questionCount: number, category: string | null = null): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    const safeDifficulty = this.isValidDifficulty(difficulty) ? difficulty : 'random';
    const validQuestionCount = this.getQuestionCountOptions();
    const safeQuestionCount = validQuestionCount.includes(questionCount)
      ? questionCount
      : validQuestionCount[0];
    const safeCategory = typeof category === 'string' && category.trim()
      ? resolveCategoryName(category)
      : null;

    this.writeJson(storage, this.configKey, {
      difficulty: safeDifficulty,
      category: safeCategory,
      questionCount: safeQuestionCount
    });
  }

  async getAvailableCategories(): Promise<QuestionCategory[]> {
    const questions = await firstValueFrom(this.http.get<Question[]>('/api/questions'));
    if (!Array.isArray(questions)) {
      throw new Error('La banque de questions reçue est invalide.');
    }

    const groups = new Map<string, { count: number; names: Map<string, number> }>();
    for (const question of questions) {
      const name = question.category.trim().replace(/\s+/g, ' ');
      if (!name) {
        continue;
      }

      const key = getCategoryKey(name);
      const group = groups.get(key) ?? { count: 0, names: new Map<string, number>() };
      group.count += 1;
      group.names.set(name, (group.names.get(name) ?? 0) + 1);
      groups.set(key, group);
    }

    return [...groups.entries()]
      .map(([key, group]) => ({
        key,
        name: key === 'soirees'
          ? 'Soirées'
          : [...group.names.entries()]
              .sort(([leftName, leftCount], [rightName, rightCount]) =>
                rightCount - leftCount ||
                leftName.localeCompare(rightName, 'fr', { sensitivity: 'base' }) ||
                leftName.localeCompare(rightName, 'fr')
              )[0][0],
        count: group.count
      }))
      .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'fr'));
  }

  async startSession(difficulty: QuizDifficulty, count: number, category: string | null = null): Promise<Question[]> {
    const questions = await firstValueFrom(this.http.get<Question[]>('/api/questions'));
    if (!Array.isArray(questions)) {
      throw new Error('La banque de questions reçue est invalide.');
    }

    const sessionQuestions = this.buildQuestionSet(questions, difficulty, count, category);
    const session: QuizSession = {
      questions: sessionQuestions,
      currentIndex: 0,
      difficulty,
      count: sessionQuestions.length,
      lastResult: undefined
    };

    this.writeJson(this.getStorage(), this.sessionKey, session);
    return sessionQuestions;
  }

  getSession(): QuizSession {
    const defaultSession: QuizSession = {
      questions: [],
      currentIndex: 0,
      difficulty: 'random',
      count: 0
    };

    const storage = this.getStorage();
    if (!storage) {
      return defaultSession;
    }

    const rawValue = storage.getItem(this.sessionKey);

    if (!rawValue) {
      return defaultSession;
    }

    try {
      const parsed = JSON.parse(rawValue) as QuizSession;
      return {
        ...defaultSession,
        ...parsed,
        questions: Array.isArray(parsed.questions) ? parsed.questions : defaultSession.questions,
        currentIndex: Number.isFinite(parsed.currentIndex) ? parsed.currentIndex : defaultSession.currentIndex,
        count: Number.isFinite(parsed.count) ? parsed.count : parsed.questions?.length ?? defaultSession.count
      };
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
      (answer) => normalizeAnswer(answer) === normalizeAnswer(selectedAnswer)
    );
    const punishment = this.punishmentService.generatePunishment(currentQuestion.difficulty);
    const result: QuizResult = {
      question: currentQuestion,
      selectedAnswer,
      isCorrect,
      punishment,
      isComplete: currentIndex >= session.questions.length - 1
    };

    session.lastResult = result;
    this.writeJson(this.getStorage(), this.sessionKey, session);
    return result;
  }

  advanceToNextQuestion(): Question | null {
    const session = this.getSession();

    if (session.currentIndex + 1 >= session.questions.length) {
      return null;
    }

    session.currentIndex += 1;
    this.writeJson(this.getStorage(), this.sessionKey, session);
    return session.questions[session.currentIndex];
  }

  getLastResult(): QuizResult | null {
    const session = this.getSession();
    return session.lastResult ?? null;
  }

  clearSession(): void {
    const storage = this.getStorage();
    if (!storage) {
      return;
    }

    try {
      storage.removeItem(this.sessionKey);
    } catch {
      // ignore browser storage restrictions
    }
  }

  private buildQuestionSet(
    questions: Question[],
    difficulty: QuizDifficulty,
    count: number,
    category: string | null
  ): Question[] {
    const categoryQuestions = category
      ? questions.filter((question) => getCategoryKey(question.category) === getCategoryKey(category))
      : questions;
    const filteredQuestions = difficulty === 'random'
      ? [...categoryQuestions]
      : categoryQuestions.filter((question) => question.difficulty === difficulty);

    const shuffledQuestions = [...filteredQuestions].sort(() => Math.random() - 0.5);
    const safeCount = Number.isFinite(count) ? Math.max(1, count) : 1;
    return shuffledQuestions.slice(0, Math.min(safeCount, shuffledQuestions.length));
  }

  private getStorage(): Storage | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const storageTestKey = '__la_vosgienne_storage_test__';
      localStorage.setItem(storageTestKey, storageTestKey);
      localStorage.removeItem(storageTestKey);
      return localStorage;
    } catch {
      return null;
    }
  }

  private writeJson(storage: Storage | null, key: string, value: unknown): void {
    if (!storage) {
      return;
    }

    try {
      storage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore browser storage restrictions
    }
  }

  private isValidDifficulty(difficulty: QuizDifficulty | undefined): difficulty is QuizDifficulty {
    return this.getAvailableDifficulties().includes(difficulty as QuizDifficulty);
  }
}
