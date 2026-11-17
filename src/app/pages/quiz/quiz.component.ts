import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Question } from '../../core/models/question.model';
import { QuizService } from '../../core/services/quiz.service';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.component.html',
  styleUrl: './quiz.component.scss'
})
export class QuizComponent implements OnInit {
  currentQuestion: Question | null = null;
  currentIndex = 0;
  totalQuestions = 0;
  selectedAnswer = '';

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
