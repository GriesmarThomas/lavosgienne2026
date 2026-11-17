import { Injectable } from '@angular/core';

export interface Punishment {
  emoji: string;
  label: string;
  type: 'beer' | 'sauce';
}

@Injectable({
  providedIn: 'root'
})
export class PunishmentService {
  private readonly beerPunishments = [
    'Bois un schlouk',
    'Un petit coup de bière pour la route',
    'C’est le moment d’un schlouk bien mérité',
    'Sers-toi une bière et continue'
  ];

  private readonly saucePunishments = [
    'Goûte une sauce',
    'Un petit coup de sauce, sans hésiter',
    'Le courage exige une bouchée de sauce',
    'Tu dois goûter une sauce, c’est la règle'
  ];

  generatePunishment(): Punishment {
    const isBeer = Math.random() <= 0.75;

    if (isBeer) {
      const label = this.beerPunishments[Math.floor(Math.random() * this.beerPunishments.length)];
      return { emoji: '🍺', label, type: 'beer' };
    }

    const label = this.saucePunishments[Math.floor(Math.random() * this.saucePunishments.length)];
    return { emoji: '🌶️', label, type: 'sauce' };
  }
}
