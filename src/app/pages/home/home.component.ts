import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  APP_TITLE,
  getCategoryIcon,
  getCategoryKey,
  QuestionCategory,
  QuizDifficulty
} from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  readonly initialCategoryLimit = 5;
  readonly appTitle = APP_TITLE;
  readonly getCategoryIcon = getCategoryIcon;
  readonly difficultyOptions: Array<QuizDifficulty> = this.quizService.getAvailableDifficulties();
  readonly questionCountOptions = this.quizService.getQuestionCountOptions();

  selectedDifficulty: QuizDifficulty = this.quizService.getSavedConfig().difficulty;
  selectedCategory: string | null = this.quizService.getSavedConfig().category;
  questionCount = this.quizService.getSavedConfig().questionCount;
  categoryOptions: QuestionCategory[] = [];
  showAllCategories = false;
  isLoadingCategories = true;
  categoryErrorMessage = '';
  isStarting = false;
  errorMessage = '';

  get visibleCategoryOptions(): QuestionCategory[] {
    if (this.showAllCategories || this.categoryOptions.length <= this.initialCategoryLimit) {
      return this.categoryOptions;
    }

    const visibleCategories = this.categoryOptions.slice(0, this.initialCategoryLimit);
    const selectedCategory = this.categoryOptions.find(
      (category) => category.key === getCategoryKey(this.selectedCategory ?? '')
    );

    return selectedCategory && !visibleCategories.some((category) => category.key === selectedCategory.key)
      ? [...visibleCategories, selectedCategory]
      : visibleCategories;
  }

  get hiddenCategoryCount(): number {
    return Math.max(0, this.categoryOptions.length - this.visibleCategoryOptions.length);
  }

  constructor(
    private readonly quizService: QuizService,
    private readonly router: Router
  ) {
    if (!this.questionCountOptions.includes(this.questionCount)) {
      this.questionCount = this.questionCountOptions[0];
    }
  }

  ngOnInit(): void {
    void this.loadCategories();
  }

  decrementQuestionCount(): void {
    this.questionCount = Math.max(1, this.questionCount - 1);
  }

  incrementQuestionCount(): void {
    const maxQuestionCount = this.questionCountOptions[this.questionCountOptions.length - 1];
    this.questionCount = Math.min(maxQuestionCount, this.questionCount + 1);
  }

  async startGame(): Promise<void> {
    this.isStarting = true;
    this.errorMessage = '';
    this.quizService.saveConfig(this.selectedDifficulty, this.questionCount, this.selectedCategory);

    try {
      const questions = await this.quizService.startSession(
        this.selectedDifficulty,
        this.questionCount,
        this.selectedCategory
      );
      if (!questions.length) {
        this.errorMessage = this.selectedCategory && this.selectedDifficulty !== 'random'
          ? 'Aucune question disponible pour cette catégorie et cette difficulté.'
          : this.selectedCategory
            ? 'Aucune question disponible pour cette catégorie.'
            : 'Aucune question disponible pour cette difficulté.';
        return;
      }

      await this.router.navigate(['/quiz']);
    } catch (error) {
      console.error('Unable to start quiz session:', error);
      this.errorMessage = 'Impossible de charger les questions. Réessaie dans un instant.';
    } finally {
      this.isStarting = false;
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      this.categoryOptions = await this.quizService.getAvailableCategories();
      if (this.selectedCategory) {
        this.selectedCategory = this.categoryOptions.find(
          (category) => category.key === getCategoryKey(this.selectedCategory ?? '')
        )?.name ?? null;
      }
    } catch (error) {
      console.error('Unable to load question categories:', error);
      this.selectedCategory = null;
      this.categoryErrorMessage = 'Impossible de charger les catégories.';
    } finally {
      this.isLoadingCategories = false;
    }
  }
}
