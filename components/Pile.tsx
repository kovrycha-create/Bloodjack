import React from 'react';
import { PileState } from '../types';
import CardDisplay from './CardDisplay';

interface PileProps {
  pile: PileState;
  pileIndex: number;
  onGuess: (pileIndex: number, direction: 'higher' | 'lower') => void;
  onPlaceFreeCard: (pileIndex: number) => void;
  mainPileEmpty: boolean;
  isSelected: boolean;
  isAiActive: boolean;
  aiAction: { pileIndex: number; direction: 'higher' | 'lower' } | null;
  isFreePlacementMode: boolean;
}

const Pile: React.FC<PileProps> = ({ pile, pileIndex, onGuess, onPlaceFreeCard, mainPileEmpty, isSelected, isAiActive, aiAction, isFreePlacementMode }) => {
  const displayCards = pile.cards.slice(-2);
  const isLocked = pile.locked || mainPileEmpty;
  const isDisabledByState = isLocked || isAiActive;

  const pileClasses = [
    "pile-frame relative w-full min-h-[220px] md:min-h-[280px] bg-gradient-to-br from-red-900 via-gray-900 to-black",
    "transition-all duration-300",
    isDisabledByState ? "cursor-not-allowed" : "cursor-pointer",
    !isFreePlacementMode && !isDisabledByState ? "hover:scale-105 hover:shadow-lg hover:shadow-red-500/30" : "",
    pile.locked && !mainPileEmpty ? "animate-shake" : "",
    isSelected && !isAiActive ? "ring-4 ring-yellow-400 ring-offset-4 ring-offset-black shadow-lg shadow-yellow-400/50" : "",
    isFreePlacementMode && !isLocked ? "ring-4 ring-blue-400 ring-offset-2 ring-offset-black shadow-lg shadow-blue-400/50 cursor-pointer hover:ring-blue-300 hover:scale-105" : ""
  ].join(' ');
  
  const isHigherPressedByAI = aiAction?.pileIndex === pileIndex && aiAction?.direction === 'higher';
  const isLowerPressedByAI = aiAction?.pileIndex === pileIndex && aiAction?.direction === 'lower';

  return (
    <div className="flex flex-col items-center w-24 md:w-40">
      <div 
        className={pileClasses}
        onClick={() => {
          if (isFreePlacementMode && !isLocked) {
            onPlaceFreeCard(pileIndex);
          }
        }}
      >
        {displayCards.map((card, index) => (
          <CardDisplay
            key={`${card.rank}-${card.suit}-${index}`}
            card={card}
            className={`
              ${displayCards.length === 2 && index === 0 ? "top-4 md:top-8 opacity-60 grayscale-[.3] z-10" : "top-16 md:top-24 z-20"}
              ${isDisabledByState ? 'grayscale' : ''}
            `}
          />
        ))}
        
        {pile.locked && !mainPileEmpty && (
          <>
            <div className="absolute inset-0 bg-black bg-opacity-70 rounded-md z-30 transition-opacity duration-300" aria-hidden="true"></div>
            <div className="absolute inset-0 flex items-center justify-center text-6xl md:text-8xl z-40" role="img" aria-label="Pile locked">
              🔒
            </div>
          </>
        )}
      </div>
      {!isFreePlacementMode && (
        <div className="mt-4 flex gap-4 md:gap-2">
          <button
            onClick={() => onGuess(pileIndex, 'higher')}
            disabled={isDisabledByState}
            className={`pile-button pile-button-higher ${isHigherPressedByAI ? 'animate-ai-press' : ''}`}
            title="Higher"
            aria-label="Guess Higher"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
            </svg>
          </button>
          <button
            onClick={() => onGuess(pileIndex, 'lower')}
            disabled={isDisabledByState}
            className={`pile-button pile-button-lower ${isLowerPressedByAI ? 'animate-ai-press' : ''}`}
            title="Lower"
            aria-label="Guess Lower"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m0 0l-7-7m7 7l7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default Pile;
