import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { APP_TITLE, getCategoryIcon, QuizDifficulty } from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  readonly appTitle = APP_TITLE;
  readonly getCategoryIcon = getCategoryIcon;
  readonly difficultyOptions: Array<QuizDifficulty> = this.quizService.getAvailableDifficulties();
  readonly questionCountOptions = this.quizService.getQuestionCountOptions();

  selectedDifficulty: QuizDifficulty = this.quizService.getSavedConfig().difficulty;
  selectedCategory: string | null = this.quizService.getSavedConfig().category;
  questionCount = this.quizService.getSavedConfig().questionCount;
  categoryOptions: string[] = [];
  isLoadingCategories = true;
  categoryErrorMessage = '';
  isStarting = false;
  errorMessage = '';

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
      if (this.selectedCategory && !this.categoryOptions.includes(this.selectedCategory)) {
        this.selectedCategory = null;
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
