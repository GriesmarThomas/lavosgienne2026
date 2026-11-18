import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { from, switchMap } from 'rxjs';
import {
  getQuestionImages,
  getCategoryIcon,
  getDifficultyLabel,
  hasExactlyOneCorrectChoice,
  MAX_QUESTION_IMAGE_BYTES,
  MAX_QUESTION_IMAGES,
  normalizeAnswer,
  Question,
  QuestionDifficulty,
  QuestionType
} from '../../core/models/question.model';
import { AdminService } from '../../core/services/admin.service';
import { QuestionImagesComponent } from '../../shared/components/question-images/question-images.component';

interface SelectedPhoto {
  file: File;
  previewUrl: string;
}

interface QuestionDraft {
  category: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  question: string;
  correctAnswer: string;
  choices: string[];
  correctChoiceIndex: number | null;
  acceptedAnswersText: string;
  image: string;
  images: string[];
  anecdote: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QuestionImagesComponent],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss'
})
export class AdminComponent implements OnInit {
  readonly getCategoryIcon = getCategoryIcon;
  readonly getDifficultyLabel = getDifficultyLabel;
  readonly difficulties: QuestionDifficulty[] = ['easy', 'medium', 'hard'];
  readonly questionTypes: QuestionType[] = ['open', 'qcm', 'image'];
  readonly maxQuestionImages = MAX_QUESTION_IMAGES;
  readonly maxQuestionImageSizeMegabytes = MAX_QUESTION_IMAGE_BYTES / 1024 / 1024;
  readonly questionImageTypes = 'image/jpeg,image/png,image/webp';

  isAuthenticated = false;
  isLoading = true;
  isSaving = false;
  username = 'admin';
  password = '';
  searchTerm = '';
  errorMessage = '';
  successMessage = '';
  questions: Question[] = [];
  previewingQuestion: Question | null = null;
  isQuestionImageOpen = false;
  selectedPhotos: SelectedPhoto[] = [];
  photoErrorMessage = '';
  isEditorOpen = false;
  editingId: number | null = null;
  draft = this.emptyDraft();

  constructor(private readonly adminService: AdminService) {}

  ngOnInit(): void {
    this.adminService.getAuthenticationStatus().subscribe({
      next: ({ authenticated }) => {
        this.isAuthenticated = authenticated;
        this.isLoading = false;

        if (authenticated) {
          this.loadQuestions();
        }
      },
      error: () => {
        this.isLoading = false;
        this.errorMessage = 'Impossible de joindre le serveur d’administration.';
      }
    });
  }

  get filteredQuestions(): Question[] {
    const search = this.searchTerm.trim().toLocaleLowerCase();
    if (!search) {
      return this.questions;
    }

    return this.questions.filter((question) =>
      `${question.question} ${question.correctAnswer} ${question.category}`
        .toLocaleLowerCase()
        .includes(search)
    );
  }

  get previewImages(): string[] {
    return this.previewingQuestion ? getQuestionImages(this.previewingQuestion) : [];
  }

  get isQcmDraftValid(): boolean {
    if (this.draft.type !== 'qcm') {
      return true;
    }

    const choices = this.draft.choices.map((choice) => choice.trim());
    const correctAnswer = choices[this.draft.correctChoiceIndex ?? -1] ?? '';

    return hasExactlyOneCorrectChoice({
      type: 'qcm',
      choices,
      correctAnswer
    });
  }

  login(): void {
    this.errorMessage = '';
    this.isSaving = true;

    this.adminService.login(this.username, this.password).subscribe({
      next: () => {
        this.password = '';
        this.isAuthenticated = true;
        this.isSaving = false;
        this.loadQuestions();
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.errorMessage = this.getErrorMessage(error, 'Connexion impossible.');
      }
    });
  }

  logout(): void {
    this.adminService.logout().subscribe({
      next: () => {
        this.isAuthenticated = false;
        this.questions = [];
        this.closePreview();
        this.resetEditor();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'Impossible de fermer la session.');
      }
    });
  }

  createQuestion(): void {
    this.resetEditor();
    this.isEditorOpen = true;
    this.draft = this.emptyDraft();
    this.errorMessage = '';
    this.successMessage = '';
  }

  editQuestion(question: Question): void {
    this.clearSelectedPhotos();
    this.isEditorOpen = true;
    this.editingId = question.id;
    const choices = question.choices ?? [];
    this.draft = {
      category: question.category,
      difficulty: question.difficulty,
      type: question.type,
      question: question.question,
      correctAnswer: question.correctAnswer,
      choices: [...choices],
      correctChoiceIndex: question.type === 'qcm'
        ? choices.findIndex((choice) => normalizeAnswer(choice) === normalizeAnswer(question.correctAnswer))
        : null,
      acceptedAnswersText: (question.acceptedAnswers ?? []).join('\n'),
      image: question.image ?? '',
      images: question.images ?? [],
      anecdote: question.anecdote ?? ''
    };
    this.errorMessage = '';
    this.successMessage = '';
    this.photoErrorMessage = '';
  }

  openPreview(question: Question): void {
    this.previewingQuestion = question;
  }

  closePreview(): void {
    this.previewingQuestion = null;
    this.isQuestionImageOpen = false;
  }

  @HostListener('document:keydown.escape')
  handleEscape(): void {
    if (!this.isQuestionImageOpen) {
      this.closePreview();
    }
  }

  setQuestionImageOpen(isOpen: boolean): void {
    this.isQuestionImageOpen = isOpen;
  }

  addChoice(): void {
    this.draft.choices.push('');
  }

  trackChoiceIndex(index: number): number {
    return index;
  }

  removeChoice(index: number): void {
    this.draft.choices.splice(index, 1);
    if (this.draft.correctChoiceIndex === index) {
      this.draft.correctChoiceIndex = null;
    } else if (this.draft.correctChoiceIndex !== null && this.draft.correctChoiceIndex > index) {
      this.draft.correctChoiceIndex -= 1;
    }
  }

  onPhotosSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.photoErrorMessage = '';

    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      this.photoErrorMessage = 'Choisis des photos au format JPG, PNG ou WebP.';
      input.value = '';
      return;
    }

    if (this.selectedPhotos.length + files.length > this.maxQuestionImages) {
      this.photoErrorMessage = `Tu peux ajouter jusqu’à ${this.maxQuestionImages} photos.`;
      input.value = '';
      return;
    }

    const selectedSize = this.selectedPhotos.reduce((total, photo) => total + photo.file.size, 0);
    const newSize = files.reduce((total, file) => total + file.size, 0);
    if (selectedSize + newSize > MAX_QUESTION_IMAGE_BYTES) {
      this.photoErrorMessage = `Le poids total des photos ne peut pas dépasser ${this.maxQuestionImageSizeMegabytes} Mo.`;
      input.value = '';
      return;
    }

    this.selectedPhotos = [
      ...this.selectedPhotos,
      ...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))
    ];
    input.value = '';
  }

  removeSelectedPhoto(index: number): void {
    const [removedPhoto] = this.selectedPhotos.splice(index, 1);
    if (removedPhoto) {
      URL.revokeObjectURL(removedPhoto.previewUrl);
    }
    this.photoErrorMessage = '';
  }

  cancelEditing(): void {
    this.resetEditor();
  }

  saveQuestion(form: NgForm): void {
    this.errorMessage = '';
    this.successMessage = '';
    if (!this.draft.category.trim()) {
      form.control.markAllAsTouched();
      this.errorMessage = 'La catégorie est obligatoire.';
      this.scrollToTop();
      return;
    }

    if (!this.draft.question.trim()) {
      form.control.markAllAsTouched();
      this.errorMessage = 'L’énoncé de la question est obligatoire.';
      this.scrollToTop();
      return;
    }

    if (!this.isQcmDraftValid) {
      form.control.markAllAsTouched();
      this.errorMessage = 'Un QCM doit proposer au moins deux réponses distinctes et une seule bonne réponse.';
      this.scrollToTop();
      return;
    }

    if (this.draft.type !== 'qcm' && !this.draft.correctAnswer.trim()) {
      form.control.markAllAsTouched();
      this.errorMessage = 'La bonne réponse est obligatoire.';
      this.scrollToTop();
      return;
    }

    if (form.invalid) {
      form.control.markAllAsTouched();
      this.errorMessage = 'Vérifie les champs obligatoires avant d’enregistrer.';
      this.scrollToTop();
      return;
    }

    this.isSaving = true;

    const questionData = this.buildQuestionData();
    const editingId = this.editingId;
    const isNewQuestion = editingId === null;
    const request = isNewQuestion
      ? from(this.readSelectedPhotos()).pipe(
          switchMap((photoUploads) => this.adminService.addQuestion(questionData, photoUploads))
        )
      : this.adminService.updateQuestion({ ...questionData, id: editingId });

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.successMessage = isNewQuestion ? 'Question ajoutée.' : 'Question modifiée.';
        this.resetEditor();
        this.scrollToTop();
        this.loadQuestions();
      },
      error: (error: unknown) => {
        this.isSaving = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible d’enregistrer la question.');
        this.scrollToTop();
      }
    });
  }

  deleteQuestion(question: Question): void {
    if (!window.confirm(`Supprimer cette question ?\n\n${question.question}`)) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';
    this.adminService.deleteQuestion(question.id).subscribe({
      next: () => {
        this.successMessage = 'Question supprimée.';
        this.scrollToTop();
        this.loadQuestions();
      },
      error: (error: unknown) => {
        this.errorMessage = this.getErrorMessage(error, 'Impossible de supprimer la question.');
        this.scrollToTop();
      }
    });
  }

  private scrollToTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private loadQuestions(): void {
    this.adminService.getQuestions().subscribe({
      next: (questions) => {
        this.questions = questions;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        this.isLoading = false;
        this.errorMessage = this.getErrorMessage(error, 'Impossible de charger les questions.');
      }
    });
  }

  private buildQuestionData(): Omit<Question, 'id'> {
    const question: Omit<Question, 'id'> = {
      category: this.draft.category.trim(),
      difficulty: this.draft.difficulty,
      type: this.draft.type,
      question: this.draft.question.trim(),
      correctAnswer: this.draft.type === 'qcm'
        ? this.draft.choices[this.draft.correctChoiceIndex ?? -1]?.trim() ?? ''
        : this.draft.correctAnswer.trim()
    };
    const acceptedAnswers = this.toLines(this.draft.acceptedAnswersText);
    const choices = this.draft.choices.map((choice) => choice.trim());

    if (this.draft.type !== 'qcm' && acceptedAnswers.length) {
      question.acceptedAnswers = acceptedAnswers;
    }

    if (this.draft.type === 'qcm') {
      question.choices = choices;
    }

    if (this.editingId !== null && this.draft.images.length) {
      question.images = this.draft.images;
    }

    if (this.draft.image.trim()) {
      question.image = this.draft.image.trim();
    }

    if (this.draft.anecdote.trim()) {
      question.anecdote = this.draft.anecdote.trim();
    }

    return question;
  }

  private toLines(value: string): string[] {
    return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  private emptyDraft(): QuestionDraft {
    return {
      category: '',
      difficulty: 'easy',
      type: 'open',
      question: '',
      correctAnswer: '',
      choices: [],
      correctChoiceIndex: null,
      acceptedAnswersText: '',
      image: '',
      images: [],
      anecdote: ''
    };
  }

  private resetEditor(): void {
    this.clearSelectedPhotos();
    this.isEditorOpen = false;
    this.editingId = null;
    this.draft = this.emptyDraft();
    this.photoErrorMessage = '';
  }

  private clearSelectedPhotos(): void {
    for (const photo of this.selectedPhotos) {
      URL.revokeObjectURL(photo.previewUrl);
    }
    this.selectedPhotos = [];
  }

  private readSelectedPhotos(): Promise<string[]> {
    return Promise.all(
      this.selectedPhotos.map(
        ({ file }) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              if (typeof reader.result === 'string') {
                resolve(reader.result);
              } else {
                reject(new Error('Impossible de lire une photo sélectionnée.'));
              }
            };
            reader.onerror = () => reject(new Error('Impossible de lire une photo sélectionnée.'));
            reader.readAsDataURL(file);
          })
      )
    );
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse && typeof error.error?.error === 'string') {
      return error.error.error;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }
}
