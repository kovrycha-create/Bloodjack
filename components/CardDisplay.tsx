import React from 'react';
import { Card } from '../types';
import { RANKS, SUIT_SYMBOLS } from '../constants';

interface CardDisplayProps {
  card: Card;
  className?: string;
}

const CardDisplay: React.FC<CardDisplayProps> = ({ card, className }) => {
  const suitColor = card.suit === 'hearts' || card.suit === 'diamonds' ? 'text-red-600' : 'text-gray-800';

  return (
    <div className={`card absolute bg-red-50 border border-red-500 rounded-md left-1/2 -translate-x-1/2 flex items-center justify-center shadow-md transition-all duration-500 ${className}`}>
      <span className={`card-rank absolute top-1 left-1.5 md:top-1 md:left-2 text-2xl md:text-4xl font-bold ${suitColor}`}>
        {RANKS[card.rank]}
      </span>
      <span className={`card-suit absolute text-5xl md:text-6xl ${suitColor}`}>
        {SUIT_SYMBOLS[card.suit]}
      </span>
      <span className={`card-rank absolute bottom-1 right-1.5 md:bottom-2 md:right-2 text-lg md:text-xl font-bold transform rotate-180 ${suitColor}`}>
        {RANKS[card.rank]}
      </span>
    </div>
  );
};

export default CardDisplay;