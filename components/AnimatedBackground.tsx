import React, { useState, useEffect, useMemo } from 'react';
import { GameStatus } from '../types';

interface AnimatedBackgroundProps {
  gameStatus: GameStatus;
  intensity: number; // 0 (start) to 1 (end)
  mood: 'calm' | 'tense' | 'euphoric' | 'danger';
  pulse?: 'good' | 'bad';
}

interface Cell {
  id: number;
  style: React.CSSProperties;
  className: string;
}

const generateInitialCells = (count: number): Cell[] => {
    return Array.from({ length: count }).map((_, i) => ({
        id: i,
        className: 'cell blood-cell',
        style: {
            top: `${Math.random() * 100}vh`,
            left: `${Math.random() * 100}vw`,
            animation: `float${(i % 4) + 1} ${25 + Math.random() * 20}s ease-in-out infinite alternate`,
            transform: `scale(${0.7 + Math.random() * 0.5})`,
            opacity: 0.15,
        }
    }));
};

const AnimatedBackground: React.FC<AnimatedBackgroundProps> = ({ gameStatus, intensity, mood, pulse }) => {
    const [cells, setCells] = useState<Cell[]>(() => generateInitialCells(20));
    const [pulseClass, setPulseClass] = useState('');

    useEffect(() => {
        if (pulse) {
            setPulseClass(pulse === 'good' ? 'pulse-good-effect' : 'pulse-bad-effect');
            const timer = setTimeout(() => setPulseClass(''), 1000); // Animation duration
            return () => clearTimeout(timer);
        }
    }, [pulse]);
    
    useEffect(() => {
        setCells(prevCells => {
            return prevCells.map(cell => {
                let opacity = 0.15 + (intensity * 0.2); // Base opacity increases with intensity
                let scale = 0.7 + Math.random() * 0.5 + (intensity * 0.1);
                let background = 'radial-gradient(circle at 30% 30%, #ff4d4d, #b30000)';
                let boxShadow = 'inset 0 0 10px rgba(0,0,0,0.5), 0 0 5px #b30000';

                if (gameStatus !== 'playing') {
                    opacity = 0.1;
                    scale = 0.6 + Math.random() * 0.4;
                } else {
                    switch (mood) {
                        case 'euphoric':
                            opacity += 0.1;
                            background = 'radial-gradient(circle at 30% 30%, #ffd700, #ff8c00)'; // Golden hues
                            boxShadow = 'inset 0 0 10px rgba(0,0,0,0.5), 0 0 15px #ffd700';
                            break;
                        case 'danger':
                            opacity += 0.15;
                            scale += 0.2;
                            background = 'radial-gradient(circle at 30% 30%, #ff1a1a, #660000)'; // Deeper, more aggressive red
                            boxShadow = 'inset 0 0 15px rgba(0,0,0,0.7), 0 0 20px #ff1a1a';
                            break;
                        case 'tense':
                            opacity += 0.05;
                            scale += 0.1;
                            break;
                    }
                }
                
                const existingTransform = cell.style.transform?.replace(/scale\([^)]+\)/, '') || '';

                return {
                    ...cell,
                    style: {
                        ...cell.style,
                        opacity,
                        transform: `${existingTransform} scale(${scale})`,
                        background,
                        boxShadow,
                    }
                };
            });
        });

    }, [gameStatus, intensity, mood]);
    
    const aggressiveCellStyles = useMemo(() => {
        let opacity = 0.25 + (intensity * 0.2);
        let scale = 1 + (intensity * 0.3);
        let background = 'radial-gradient(circle at 30% 30%, #ff8080, #660000)';
        
        if (gameStatus !== 'playing') {
            opacity = 0.2;
            scale = 0.9;
        } else {
             if (mood === 'danger') {
                opacity = 0.5;
                scale = 1.5;
                background = 'radial-gradient(circle at 30% 30%, #ff0000, #330000)';
            } else if (mood === 'euphoric') {
                opacity = 0.15;
                scale = 0.8;
            }
        }
        
        return {
            opacity,
            transform: `scale(${scale})`,
            background,
        };
    }, [gameStatus, intensity, mood]);


    return (
        <div className={`animated-background ${pulseClass}`}>
            <div className="cell aggressive-cell" style={aggressiveCellStyles}></div>
            {cells.map(cell => (
                <div key={cell.id} className={cell.className} style={cell.style} />
            ))}
        </div>
    );
};

export default AnimatedBackground;