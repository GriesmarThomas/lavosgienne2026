import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

@Component({
  selector: 'app-question-images',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './question-images.component.html',
  styleUrl: './question-images.component.scss'
})
export class QuestionImagesComponent {
  @Input() images: string[] = [];
  @Input() altText = 'Photo associée à la question';
  @Output() lightboxOpenChange = new EventEmitter<boolean>();

  openedImage: string | null = null;

  openImage(image: string): void {
    this.openedImage = image;
    this.lightboxOpenChange.emit(true);
  }

  @HostListener('document:keydown.escape')
  closeImage(): void {
    if (!this.openedImage) {
      return;
    }

    this.openedImage = null;
    this.lightboxOpenChange.emit(false);
  }
}
