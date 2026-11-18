import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { getCategoryIcon, getDifficultyLabel } from '../../core/models/question.model';
import { QuizResult, QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-result',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './result.component.html',
  styleUrl: './result.component.scss'
})
export class ResultComponent implements OnInit {
  readonly getCategoryIcon = getCategoryIcon;
  readonly getDifficultyLabel = getDifficultyLabel;
  result: QuizResult | null = null;
  isFinalScreen = false;
  sessionScore = { correct: 0, incorrect: 0 };

  constructor(
    private readonly quizService: QuizService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const lastResult = this.quizService.getLastResult();

    if (!lastResult) {
      this.router.navigate(['/']);
      return;
    }

    this.result = lastResult;
    this.isFinalScreen = lastResult.isComplete;
    if (this.isFinalScreen) {
      this.sessionScore = this.quizService.getSessionScore();
    }
  }

  continue(): void {
    if (!this.result) {
      return;
    }

    if (this.isFinalScreen) {
      this.quizService.clearSession();
      this.router.navigate(['/']);
      return;
    }

    this.quizService.advanceToNextQuestion();
    this.router.navigate(['/quiz']);
  }
}
