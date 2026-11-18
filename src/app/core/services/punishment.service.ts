import { Injectable } from '@angular/core';
import type { QuestionDifficulty } from '../models/question.model';

export interface Punishment {
  emoji: string;
  label: string;
  type: 'drink' | 'sauce' | 'snack';
}

@Injectable({
  providedIn: 'root'
})
export class PunishmentService {
  private readonly punishments: Record<QuestionDifficulty, Punishment[]> = {
    easy: [
      { emoji: '🍺', label: 'Un schlouk de bière sans alcool', type: 'drink' },
      { emoji: '🥨', label: 'Une petite bouchée de snack au choix', type: 'snack' },
      { emoji: '🌶️', label: 'Une sauce légère', type: 'sauce' }
    ],
    medium: [
      { emoji: '🍺', label: '2 schlouks de bière sans alcool', type: 'drink' },
      { emoji: '🍺', label: '3 schlouks de bière sans alcool', type: 'drink' },
      { emoji: '🌶️', label: 'Une petite quantité de sauce modérée', type: 'sauce' }
    ],
    hard: [
      { emoji: '🍺', label: '4 schlouks de bière sans alcool', type: 'drink' },
      { emoji: '🍺', label: '5 schlouks de bière sans alcool', type: 'drink' },
      { emoji: '🌶️', label: 'Une petite quantité de sauce piquante', type: 'sauce' },
      { emoji: '🥤', label: 'Un verre de boisson sans alcool, à ton rythme', type: 'drink' }
    ]
  };

  generatePunishment(difficulty: QuestionDifficulty): Punishment {
    const options = this.punishments[difficulty];
    return options[Math.floor(Math.random() * options.length)];
  }
}
