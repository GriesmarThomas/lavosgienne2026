import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  getCategoryIcon,
  getDifficultyLabel,
  getQuestionImages,
  Question
} from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';
import { QuestionImagesComponent } from '../../shared/components/question-images/question-images.component';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule, QuestionImagesComponent],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.scss'
})
export class QuizComponent implements OnInit {
  readonly getCategoryIcon = getCategoryIcon;
  readonly getDifficultyLabel = getDifficultyLabel;
  currentQuestion: Question | null = null;
  currentIndex = 0;
  totalQuestions = 0;
  selectedAnswer = '';

  get questionImages(): string[] {
    return this.currentQuestion ? getQuestionImages(this.currentQuestion) : [];
  }

  constructor(
    private readonly quizService: QuizService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const session = this.quizService.getSession();

    if (!session.questions.length) {
      this.router.navigate(['/']);
      return;
    }

    this.currentIndex = session.currentIndex;
    this.totalQuestions = session.questions.length;
    this.currentQuestion = this.quizService.getCurrentQuestion();
  }

  submitAnswer(): void {
    const answer = this.selectedAnswer.trim();

    if (!this.currentQuestion || !answer) {
      return;
    }

    this.quizService.submitAnswer(answer);
    this.router.navigate(['/result']);
  }
}
