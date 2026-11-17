import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { APP_TITLE, QuizDifficulty } from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent {
  readonly appTitle = APP_TITLE;
  readonly difficultyOptions: Array<QuizDifficulty> = this.quizService.getAvailableDifficulties();
  readonly questionCountOptions = this.quizService.getQuestionCountOptions();

  selectedDifficulty: QuizDifficulty = this.quizService.getSavedConfig().difficulty;
  questionCount = this.quizService.getSavedConfig().questionCount;

  constructor(
    private readonly quizService: QuizService,
    private readonly router: Router
  ) {
    if (!this.questionCountOptions.includes(this.questionCount)) {
      this.questionCount = this.questionCountOptions[0];
    }
  }

  decrementQuestionCount(): void {
    this.questionCount = Math.max(1, this.questionCount - 1);
  }

  incrementQuestionCount(): void {
    const maxQuestionCount = this.questionCountOptions[this.questionCountOptions.length - 1];
    this.questionCount = Math.min(maxQuestionCount, this.questionCount + 1);
  }

  startGame(): void {
    this.quizService.saveConfig(this.selectedDifficulty, this.questionCount);
    this.quizService.startSession(this.selectedDifficulty, this.questionCount);
    this.router.navigate(['/quiz']);
  }
}
