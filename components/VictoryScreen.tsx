
import React from 'react';
import { GameStats } from '../types';

interface VictoryScreenProps {
  stats: GameStats;
  onPlayAgain: () => void;
  message: string;
}

const StatItem: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="flex justify-between items-baseline py-2 border-b border-yellow-400/20">
    <span className="text-gray-300">{label}</span>
    <span className="font-bold text-2xl text-yellow-300" style={{ fontFamily: "'Cinzel Decorative', cursive" }}>
      {value}
    </span>
  </div>
);

const VictoryScreen: React.FC<VictoryScreenProps> = ({ stats, onPlayAgain, message }) => {
  const correctPercentage = stats.totalGuesses > 0 
    ? ((stats.correctGuesses / stats.totalGuesses) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="modal-overlay">
      <div 
        className="modal-content !max-w-3xl !border-yellow-500" 
        style={{ background: 'radial-gradient(circle at top, #2a2a0a, #1a1a1a)', boxShadow: '0 0 40px rgba(250, 204, 21, 0.4)'}}
      >
        <h2 className="text-5xl md:text-6xl text-center text-yellow-300 !mb-4" style={{ textShadow: '0 0 15px rgba(250, 204, 21, 0.7)'}}>
          VICTORY
        </h2>
        <p className="text-center text-xl text-gray-300 mb-8">
          {message || "You have defied destiny and reclaimed your identity."}
        </p>

        <div className="grid md:grid-cols-2 gap-x-12 gap-y-4 mb-10 text-lg">
          <StatItem label="Total Guesses" value={stats.totalGuesses} />
          <StatItem label="Correct Guesses" value={stats.correctGuesses} />
          <StatItem label="Incorrect Guesses" value={stats.incorrectGuesses} />
          <StatItem label="Guess Accuracy" value={`${correctPercentage}%`} />
          <StatItem label="Longest Streak" value={stats.longestStreak} />
          <StatItem label="Jokers Used" value={stats.jokersUsed} />
          <StatItem label="Bloodsurges" value={stats.bloodsurgesTriggered} />
          <StatItem label="Special Cards" value={stats.acesEncountered + stats.jacksEncountered + stats.royalsEncountered + stats.trickstersEncountered} />
        </div>

        <div>
          <h3 className="text-2xl text-center mb-4 text-yellow-400">Guess Timeline</h3>
          <div className="flex h-10 w-full bg-black/50 rounded-lg border border-gray-700 p-1 gap-0.5 overflow-hidden">
            {stats.guessHistory.length === 0 && (
                <div className="flex-grow flex items-center justify-center text-gray-400">No guesses were made.</div>
            )}
            {stats.guessHistory.map((correct, index) => (
              <div 
                key={index} 
                className={`flex-grow ${correct ? 'bg-green-500' : 'bg-red-600'}`}
                title={`Guess #${index + 1}: ${correct ? 'Correct' : 'Incorrect'}`}
                style={{ minWidth: '4px' }}
              />
            ))}
          </div>
        </div>
        
        <div className="text-center">
          <button onClick={onPlayAgain} className="btn btn-primary mt-12 text-xl">
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default VictoryScreen;
