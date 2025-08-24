
import { Suit } from './types';

export const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export const SUIT_SYMBOLS: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export const RANKS: string[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export const INITIAL_MAIN_PILE_SIZE = 46;

export function getCardDisplay(card: { rank: number; suit: Suit }): string {
    return `${RANKS[card.rank]}${SUIT_SYMBOLS[card.suit]}`;
}

export function cardValue(card: { rank: number; suit: Suit }): number {
    if (card.rank === 0) return 0; // Ace; not used in comparisons.
    if (card.rank >= 1 && card.rank <= 9) return card.rank + 1;
    if (card.rank === 10) return 11; // Jack
    if (card.rank === 11) return 12; // Queen
    if (card.rank === 12) return 13; // King
    return 0;
}
