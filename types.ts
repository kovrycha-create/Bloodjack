
export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export interface Card {
  rank: number; // 0 for Ace, 1 for 2, ..., 12 for King
  suit: Suit;
}

export interface PileState {
  cards: Card[];
  locked: boolean;
  lockedByJack: boolean;
}

export interface LogEntry {
  message: string;
  type: "info" | "success" | "warning" | "error";
  timestamp: string;
}

export type GameStatus = "not-started" | "playing" | "won" | "lost";

export type ModalType = 
  | "none" 
  | "rules" 
  | "lore" 
  | "settings"
  | "royaltyGuess" 
  | "trickster" 
  | "unlockPile" 
  | "finalGuess" 
  | "jokerFinalGuess";

export interface ModalState {
  type: ModalType;
  data?: {
    pileIndex?: number;
    unlockablePiles?: number[];
  };
}

export interface GameStats {
  totalGuesses: number;
  correctGuesses: number;
  incorrectGuesses: number;
  longestStreak: number;
  acesEncountered: number;
  jacksEncountered: number;
  royalsEncountered: number; // K, Q
  trickstersEncountered: number; // 10
  bloodsurgesTriggered: number;
  jokersUsed: number;
  guessHistory: boolean[]; // true for correct, false for incorrect
}