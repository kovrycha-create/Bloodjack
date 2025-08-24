

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, PileState, LogEntry, GameStatus, ModalState, Suit, GameStats } from './types';
import { SUITS, RANKS, INITIAL_MAIN_PILE_SIZE, getCardDisplay, cardValue } from './constants';
import Pile from './components/Pile';
import AnimatedBackground from './components/AnimatedBackground';
import VictoryScreen from './components/VictoryScreen';

const Modal: React.FC<{ children: React.ReactNode; onClose: () => void }> = ({ children, onClose }) => {
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                {children}
            </div>
        </div>
    );
};

const GAME_TIPS = [
    "Guess if the next card is higher or lower. Card values: A=1, J=11, Q=12, K=13.",
    "Use Arrow Keys to select a pile (← →) and guess (↑ ↓).",
    "Aces are powerful: They discard the entire pile and start a new one.",
    "Beware the Jack: It seals any pile it lands on. Three Jack-sealed piles is an instant loss!",
    "A lone King allows a 'royalty' guess for a free card. A King and Queen together grant 5 free cards!",
    "A Queen grants two 'free' card placements without needing to guess.",
    "The Ten is a Trickster: Guess the next card's suit or rank for big rewards!",
    "A Bloodsurge (two same-ranked cards in a row) flips two more cards for free.",
    "Jokers are your lifeline: Use one to clear and reset all locked piles.",
    "The goal: Empty the main pile and correctly guess the final hidden card to win.",
];

const initialGameStats: GameStats = {
  totalGuesses: 0,
  correctGuesses: 0,
  incorrectGuesses: 0,
  longestStreak: 0,
  acesEncountered: 0,
  jacksEncountered: 0,
  royalsEncountered: 0,
  trickstersEncountered: 0,
  bloodsurgesTriggered: 0,
  jokersUsed: 0,
  guessHistory: [],
};

function App() {
    // Game State
    const [mainPile, setMainPile] = useState<Card[]>([]);
    const [piles, setPiles] = useState<PileState[]>([]);
    const [jokerCount, setJokerCount] = useState(2);
    const [gameLog, setGameLog] = useState<LogEntry[]>([]);
    const [pastGamesHistory, setPastGamesHistory] = useState<string[]>([]);
    const [gameStatus, setGameStatus] = useState<GameStatus>("not-started");
    const [winLossMessage, setWinLossMessage] = useState("");
    const [finalRandomCard, setFinalRandomCard] = useState<Card | null>(null);
    const [correctStreak, setCorrectStreak] = useState(0);
    const [incorrectStreak, setIncorrectStreak] = useState(0);
    const [gameStats, setGameStats] = useState<GameStats>(initialGameStats);
    const [freeCardsRemaining, setFreeCardsRemaining] = useState(0);
    const [isKQBonusActive, setIsKQBonusActive] = useState(false);

    // UI/Settings State
    const [modal, setModal] = useState<ModalState>({ type: 'none' });
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [musicEnabled, setMusicEnabled] = useState(true);
    const [showTimestamps, setShowTimestamps] = useState(false);
    const [isTipsCollapsed, setIsTipsCollapsed] = useState(false);
    const [currentTipIndex, setCurrentTipIndex] = useState(0);
    const [displayTips, setDisplayTips] = useState([GAME_TIPS[0]]);
    const [selectedPileIndex, setSelectedPileIndex] = useState<number | null>(null);
    const [firstGuessMade, setFirstGuessMade] = useState(false);
    const [backgroundPulse, setBackgroundPulse] = useState<'good' | 'bad' | null>(null);

    // AI State
    const [isAutoPlay, setIsAutoPlay] = useState(false);
    const [isAiTurboMode, setIsAiTurboMode] = useState(false);
    const [isAiThinking, setIsAiThinking] = useState(false);
    const [aiConfidence, setAiConfidence] = useState<number>(0);
    const [aiAction, setAiAction] = useState<{ pileIndex: number; direction: 'higher' | 'lower' } | null>(null);

    // Refs
    const audioRefs = {
        bloodlock: useRef<HTMLAudioElement>(null),
        jokerUsed: useRef<HTMLAudioElement>(null),
        lastCard: useRef<HTMLAudioElement>(null),
        bloodsurge: useRef<HTMLAudioElement>(null),
        aceReset: useRef<HTMLAudioElement>(null),
        winOverride: useRef<HTMLAudioElement>(null),
        music: useRef<HTMLAudioElement>(null),
    };
    const musicStarted = useRef(false);
    
    // Sound Player
    const playSound = useCallback((sound: keyof typeof audioRefs) => {
        if (soundEnabled) {
            const audio = audioRefs[sound].current;
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(e => console.error("Sound play failed:", e));
            }
        }
    }, [soundEnabled, audioRefs]);

    // Game Logger
    const log = useCallback((message: string, type: LogEntry['type']) => {
        const newEntry: LogEntry = {
            message,
            type,
            timestamp: new Date().toLocaleTimeString(),
        };
        setGameLog(prevLog => [newEntry, ...prevLog].slice(0, 100));
    }, []);
    
    // Game Initialization
    const initializeGame = useCallback(() => {
        let deck: Card[] = [];
        for (const suit of SUITS) {
            for (let rank = 0; rank < 13; rank++) {
                // Rule: Exclude Jack of Diamonds
                if (!(suit === "diamonds" && RANKS[rank] === "J")) {
                    deck.push({ rank, suit });
                }
            }
        }
        deck = deck.sort(() => Math.random() - 0.5);

        // Rule: Remove Ace of Spades and one random card for the endgame
        const aceOfSpadesIndex = deck.findIndex(c => c.rank === 0 && c.suit === 'spades');
        if (aceOfSpadesIndex > -1) {
            deck.splice(aceOfSpadesIndex, 1);
        } else {
            console.warn("Ace of Spades not found in deck?");
        }
        const finalRandom = deck.splice(Math.floor(Math.random() * deck.length), 1)[0];
        setFinalRandomCard(finalRandom);

        let initialPiles: PileState[];
        let tempMainPile: Card[];
        
        do {
            tempMainPile = [...deck];
            initialPiles = [
                { cards: [tempMainPile.shift()!], locked: false, lockedByJack: false },
                { cards: [tempMainPile.shift()!], locked: false, lockedByJack: false },
                { cards: [tempMainPile.shift()!], locked: false, lockedByJack: false },
            ];
        } while (initialPiles.some(p => RANKS[p.cards[0].rank] === "J"));

        setMainPile(tempMainPile);
        setPiles(initialPiles);
        setJokerCount(2);
        setGameLog([]);
        setWinLossMessage("");
        setModal({ type: 'none' });
        musicStarted.current = false;
        setCurrentTipIndex(0);
        setFirstGuessMade(false);
        setCorrectStreak(0);
        setIncorrectStreak(0);
        setGameStats(initialGameStats);
        setBackgroundPulse(null);
        setIsAutoPlay(false);
        setIsAiThinking(false);
        setIsAiTurboMode(false);
        setFreeCardsRemaining(0);
        setIsKQBonusActive(false);
        log(`Game ready. Main pile has ${tempMainPile.length} cards.`, "info");
    }, [log]);

    useEffect(() => {
        initializeGame();
    }, [initializeGame]);
    
    useEffect(() => {
        setGameStats(prev => ({ ...prev, longestStreak: Math.max(prev.longestStreak, correctStreak) }));
    }, [correctStreak]);

    useEffect(() => {
        if (firstGuessMade) {
            let subsequentTips = GAME_TIPS.slice(1);
            if (window.innerWidth < 768) {
                subsequentTips = subsequentTips.filter(tip => !tip.includes("Arrow Keys"));
            }
            setDisplayTips(subsequentTips);
            setCurrentTipIndex(0);
        } else {
            setDisplayTips([GAME_TIPS[0]]);
            setCurrentTipIndex(0);
        }
    }, [firstGuessMade]);

    useEffect(() => {
        if (gameStatus === 'playing' && !isTipsCollapsed && mainPile.length > 0 && firstGuessMade && displayTips.length > 0 && !isAutoPlay) {
            const isSpecial = displayTips[currentTipIndex]?.includes("Arrow Keys");
            const duration = isSpecial ? 10000 : 7000;

            const timer = setTimeout(() => {
                setCurrentTipIndex(prevIndex => (prevIndex + 1) % displayTips.length);
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [currentTipIndex, isTipsCollapsed, gameStatus, mainPile.length, firstGuessMade, displayTips, isAutoPlay]);
    
    useEffect(() => {
        if (backgroundPulse) {
            const timer = setTimeout(() => setBackgroundPulse(null), 1000);
            return () => clearTimeout(timer);
        }
    }, [backgroundPulse]);

    useEffect(() => {
        const storedHistory = localStorage.getItem('bloodjackHistory');
        if (storedHistory) {
            setPastGamesHistory(JSON.parse(storedHistory));
        }
    }, []);

    const recordCompletedGame = useCallback((outcome: string) => {
        const newHistory = [...pastGamesHistory, `Game Over: ${outcome} (Main Pile Left: ${mainPile.length})`];
        setPastGamesHistory(newHistory);
        localStorage.setItem('bloodjackHistory', JSON.stringify(newHistory));
    }, [pastGamesHistory, mainPile.length]);
    
    // Game Over Checks
    useEffect(() => {
        if (gameStatus !== 'playing') return;
        
        // Rule: If all three rows are locked by a Jack the game is automatically OVER.
        if (piles.every(p => p.lockedByJack)) {
            log("All piles sealed by Jacks. A grim, unavoidable fate.", "error");
            playSound('lastCard');
            setGameStatus("lost");
            setWinLossMessage("Sealed by three Jacks. Game over.");
            recordCompletedGame("Loss - All piles locked by Jacks");
            return;
        }

        const allLocked = piles.every(p => p.locked);
        if (allLocked) {
            if (jokerCount > 0) {
                log("All piles sealed. Use a Joker to clear them.", "warning");
            } else {
                log("All piles sealed and no Jokers remain. The game is lost.", "error");
                playSound('lastCard');
                setGameStatus("lost");
                setWinLossMessage("All piles locked with no Jokers left.");
                recordCompletedGame("Loss - All piles locked");
            }
        } else if (mainPile.length === 0 && freeCardsRemaining === 0 && modal.type === 'none') {
            playSound('lastCard');
            log("Main pile exhausted. The final guess is upon you.", "warning");
            if(!isAutoPlay) setModal({ type: 'finalGuess' });
        }
    }, [piles, mainPile.length, jokerCount, log, playSound, gameStatus, recordCompletedGame, isAutoPlay, freeCardsRemaining, modal.type]);

    useEffect(() => {
        const music = audioRefs.music.current;
        if (music) {
            if (musicEnabled && gameStatus === 'playing') {
                if(musicStarted.current) music.play().catch(e => console.error("Music play failed:", e));
            } else {
                music.pause();
                music.currentTime = 0;
            }
        }
    }, [musicEnabled, gameStatus, audioRefs.music]);

    const startGame = () => {
        setGameStatus('playing');
        if (!musicStarted.current && musicEnabled) {
            audioRefs.music.current?.play().catch(e => console.error("Music play failed:", e));
            musicStarted.current = true;
        }
    };
    
    const updatePile = useCallback((index: number, newCards: Card[], locked: boolean, lockedByJack: boolean) => {
        setPiles(prev => prev.map((p, i) => i === index ? {
            cards: newCards,
            locked: locked,
            lockedByJack: lockedByJack,
        } : p));
    }, []);

    const handleUnlockPileChoice = useCallback((pileToUnlockIndex: number) => {
        setModal({ type: 'none' });
        log(`Pile ${pileToUnlockIndex + 1} has been unlocked by the Bloodsurge.`, "success");
        setPiles(p => p.map((pile, i) => i === pileToUnlockIndex ? { ...pile, locked: false } : pile));
    }, [log]);

    const handleTricksterGuess = useCallback((pileIndex: number, guess: { rank?: string, suit?: Suit }) => {
        setModal({ type: 'none' });
        const nextCard = mainPile[0];
        if (!nextCard) {
            log("Trickster has no card to check against!", "warning");
            return;
        }

        setMainPile(p => p.slice(1)); // Consume card
        log(`Trickster's card is ${getCardDisplay(nextCard)}. Your guess: ${guess.rank || ''} ${guess.suit || ''}.`, "info");
        
        const rankCorrect = guess.rank && RANKS[nextCard.rank] === guess.rank;
        const suitCorrect = guess.suit && nextCard.suit === guess.suit;

        let incorrectGuessMade = (guess.rank && !rankCorrect) || (guess.suit && !suitCorrect);
        let correctGuessMade = rankCorrect || suitCorrect;

        if (suitCorrect) {
            log("Suit guess correct! Pile is cleared.", "success");
            const newCard = mainPile[1]; // The card after the consumed one
            setPiles(p => p.map((pi, i) => i === pileIndex ? { cards: newCard ? [newCard] : [], locked: false, lockedByJack: false } : pi));
            if (newCard) setMainPile(p => p.slice(1));
        }
        if (rankCorrect) {
            log("Rank guess correct! You regain a Joker.", "success");
            setJokerCount(c => Math.min(2, c + 1));
        }

        if (incorrectGuessMade) {
            log("An incorrect guess was made. The Trickster locks the pile.", "error");
            playSound('bloodlock');
            setPiles(p => p.map((pi, i) => i === pileIndex ? { ...pi, locked: true } : pi));
        } else if (!correctGuessMade && (guess.rank || guess.suit)) {
             log("An incorrect guess was made. The Trickster locks the pile.", "error");
             playSound('bloodlock');
             setPiles(p => p.map((pi, i) => i === pileIndex ? { ...pi, locked: true } : pi));
        }
    }, [mainPile, log, playSound]);

    const handleRoyaltyGuess = useCallback((pileIndex: number, guessIsRoyalty: boolean) => {
        setModal({ type: 'none' });
        const nextCard = mainPile[0];
        if (!nextCard) return;

        setMainPile(p => p.slice(1)); // Consume the card
        const isActuallyRoyalty = cardValue(nextCard) >= 12;

        if (guessIsRoyalty === isActuallyRoyalty) {
            log(`Royalty Guess Correct! (${getCardDisplay(nextCard)}). 1 free placement awarded.`, "success");
            setFreeCardsRemaining(1);
            setIsKQBonusActive(false);
        } else {
            log(`Royalty Guess Incorrect! (${getCardDisplay(nextCard)}). Pile ${pileIndex + 1} locks.`, "error");
            playSound('bloodlock');
            setPiles(prev => prev.map((p, i) => i === pileIndex ? { ...p, locked: true } : p));
        }
    }, [mainPile, log, playSound]);

    const makeGuess = useCallback((pileIndex: number, direction: 'higher' | 'lower') => {
        if (!firstGuessMade) setFirstGuessMade(true);
        if (piles[pileIndex].locked || mainPile.length === 0 || gameStatus !== 'playing' || freeCardsRemaining > 0) return;

        const nextCard = mainPile[0];
        const previousCard = piles[pileIndex].cards.slice(-1)[0];
        
        log(`Guess: ${direction} than ${getCardDisplay(previousCard)}. Flipped: ${getCardDisplay(nextCard)} on Pile ${pileIndex + 1}.`, "info");

        const diff = cardValue(nextCard) - cardValue(previousCard);
        const correct = (direction === 'higher' && diff > 0) || (direction === 'lower' && diff < 0) || diff === 0;

        setGameStats(prev => ({
            ...prev,
            totalGuesses: prev.totalGuesses + 1,
            correctGuesses: prev.correctGuesses + (correct ? 1 : 0),
            incorrectGuesses: prev.incorrectGuesses + (correct ? 0 : 1),
            guessHistory: [...prev.guessHistory, correct],
        }));

        setMainPile(prev => prev.slice(1));
        const newCards = [...piles[pileIndex].cards, nextCard];
        updatePile(pileIndex, newCards, piles[pileIndex].locked, piles[pileIndex].lockedByJack);
        
        if (!correct) {
            setIncorrectStreak(s => s + 1);
            setCorrectStreak(0);
            setBackgroundPulse('bad');
            playSound('bloodlock');
            log(`Incorrect guess! Pile ${pileIndex + 1} locks.`, "error");
            updatePile(pileIndex, newCards, true, piles[pileIndex].lockedByJack);
            return;
        }
        
        // Correct Guess Logic
        setCorrectStreak(s => s + 1);
        setIncorrectStreak(0);
        setBackgroundPulse('good');
        log("Correct guess!", "success");

        // --- SPECIAL CARD RULES ---
        const rank = RANKS[nextCard.rank];

        // Rule: Ace - discards pile, starts a new one
        if (rank === "A") {
            playSound('aceReset');
            log(`Ace discards Pile ${pileIndex + 1}. A new pile starts.`, "success");
            setGameStats(prev => ({ ...prev, acesEncountered: prev.acesEncountered + 1 }));
            const newStartCard = mainPile[1]; // mainPile[0] was the ace, now gone.
            setPiles(prev => {
                const newPiles = [...prev];
                newPiles[pileIndex] = { cards: newStartCard ? [newStartCard] : [], locked: false, lockedByJack: false };
                return newPiles;
            });
            if (newStartCard) {
                setMainPile(prev => prev.slice(1));
            }
            return;
        }

        // Rule: Jack - locks the pile
        if (rank === "J") {
            playSound('bloodlock');
            log(`Jack placed. Pile ${pileIndex + 1} is sealed by a Jack.`, "error");
            setGameStats(prev => ({ ...prev, jacksEncountered: prev.jacksEncountered + 1 }));
            updatePile(pileIndex, newCards, true, true);
            return;
        }
        
        // Rule: King and Queen next to each other
        const prevRank = RANKS[previousCard.rank];
        if ((rank === "K" && prevRank === "Q") || (rank === "Q" && prevRank === "K")) {
            log("King & Queen adjacent! 5 free placements awarded.", "success");
            setFreeCardsRemaining(5);
            setIsKQBonusActive(true);
            return;
        }

        // Rule: Queen - flip two free cards
        if (rank === "Q") {
            setGameStats(prev => ({ ...prev, royalsEncountered: prev.royalsEncountered + 1 }));
            log("Queen offers 2 free placements.", "success");
            setFreeCardsRemaining(2);
            setIsKQBonusActive(false);
            return;
        }
        
        // Rule: King - royalty guess
        if (rank === "K") {
            setGameStats(prev => ({ ...prev, royalsEncountered: prev.royalsEncountered + 1 }));
            const hasOtherRoyalty = piles[pileIndex].cards.some(c => RANKS[c.rank] === "K" || RANKS[c.rank] === "Q");
            if (!hasOtherRoyalty) {
                log("A lone King appears. Guess if the next card is royalty.", "warning");
                if (!isAutoPlay) {
                    setModal({ type: 'royaltyGuess', data: { pileIndex } });
                } else {
                    // AI makes a calculated guess
                    const remainingDeck = mainPile.slice(1); // Cards left after this King
                    if (remainingDeck.length > 0) {
                        const royaltyCount = remainingDeck.filter(c => c.rank === 11 || c.rank === 12).length; // Q, K
                        const probability = royaltyCount / remainingDeck.length;
                        // The natural probability of royalty is 8/52 (~15.4%). AI guesses if it's better than that.
                        const aiGuessedRoyalty = probability > (8 / 52); 
                        log(`AI calculates royalty probability: ${(probability * 100).toFixed(1)}%. Guesses ${aiGuessedRoyalty ? 'Royalty' : 'Commoner'}.`, 'info');
                        handleRoyaltyGuess(pileIndex, aiGuessedRoyalty);
                    } else {
                        // No cards left to guess against, guess false
                        log(`AI has no cards to guess against for royalty. Assuming commoner.`, 'info');
                        handleRoyaltyGuess(pileIndex, false);
                    }
                }
            }
            return;
        }

        // Rule: 10 (Trickster) - option to guess
        if (rank === "10") {
            setGameStats(prev => ({ ...prev, trickstersEncountered: prev.trickstersEncountered + 1 }));
            log("The Trickster (10) offers a wager.", "warning");
            if (!isAutoPlay) setModal({ type: 'trickster', data: { pileIndex } });
            else handleTricksterGuess(pileIndex, {}); // AI declines to guess
            return;
        }

        // Rule: Bloodsurge - same rank
        if (nextCard.rank === previousCard.rank) {
            log("Bloodsurge triggered! Two free cards are flipped.", "warning");
            setGameStats(prev => ({ ...prev, bloodsurgesTriggered: prev.bloodsurgesTriggered + 1 }));
            playSound('bloodsurge');
            
            const [card1, card2] = mainPile.slice(1, 3);
            const cardsToAdd = [card1, card2].filter(Boolean);
            const finalCards = [...newCards, ...cardsToAdd];
            
            setPiles(prev => prev.map((p, i) => i === pileIndex ? { ...p, cards: finalCards } : p));
            setMainPile(prev => prev.slice(cardsToAdd.length));

            if (card1 && card2) {
                if (card1.suit === card2.suit) {
                    const unlockablePiles = piles.map((p, i) => ({...p, index: i}))
                        .filter(p => p.locked && !p.lockedByJack).map(p => p.index);
                    
                    if (unlockablePiles.length > 0) {
                        log("Bloodsurge: Suits match! Choose a non-Jack-locked pile to unlock.", "success");
                        if (!isAutoPlay) setModal({ type: 'unlockPile', data: { pileIndex, unlockablePiles }});
                        else handleUnlockPileChoice(unlockablePiles[0]); // AI unlocks the first possible pile
                    } else {
                        log("Bloodsurge: Suits match, but no piles to unlock.", "info");
                    }
                } else {
                    log("Bloodsurge: Suits don't match. The pile locks!", "error");
                    playSound('bloodlock');
                    setPiles(prev => prev.map((p, i) => i === pileIndex ? { ...p, cards: finalCards, locked: true } : p));
                }
            }
        }
    }, [firstGuessMade, piles, mainPile, gameStatus, freeCardsRemaining, log, updatePile, playSound, isAutoPlay, handleRoyaltyGuess, handleTricksterGuess, handleUnlockPileChoice]);
    
    const handleFreeCardPlacement = useCallback((pileIndex: number) => {
        if (freeCardsRemaining <= 0 || piles[pileIndex].locked || mainPile.length === 0) return;

        const cardToPlace = mainPile[0];
        setMainPile(p => p.slice(1));
        const newCards = [...piles[pileIndex].cards, cardToPlace];
        
        log(`Free card: ${getCardDisplay(cardToPlace)} placed on Pile ${pileIndex + 1}.`, "info");
        updatePile(pileIndex, newCards, piles[pileIndex].locked, piles[pileIndex].lockedByJack);
        
        // Rule: If K/Q bonus is active, and a K or Q is flipped, the pile locks.
        if (isKQBonusActive && (RANKS[cardToPlace.rank] === "K" || RANKS[cardToPlace.rank] === "Q")) {
            log("Royalty appeared during the bonus! The pile locks and the bonus ends.", "error");
            playSound('bloodlock');
            updatePile(pileIndex, newCards, true, piles[pileIndex].lockedByJack);
            setFreeCardsRemaining(0);
            setIsKQBonusActive(false);
            return;
        }

        // Rule: Ace still resets the pile, even on a free placement.
        if (RANKS[cardToPlace.rank] === "A") {
            playSound('aceReset');
            log(`An Ace appeared on a free placement! Pile ${pileIndex + 1} is discarded and reset.`, "success");
            setGameStats(prev => ({ ...prev, acesEncountered: prev.acesEncountered + 1 }));
            const newStartCard = mainPile[1]; // The next card after the Ace
            setPiles(prev => {
                const newPiles = [...prev];
                newPiles[pileIndex] = { cards: newStartCard ? [newStartCard] : [], locked: false, lockedByJack: false };
                return newPiles;
            });
            if (newStartCard) {
                setMainPile(prev => prev.slice(1));
            }
        }

        if (freeCardsRemaining - 1 === 0) {
             setIsKQBonusActive(false);
        }
        setFreeCardsRemaining(r => r - 1);
    }, [freeCardsRemaining, piles, mainPile, log, isKQBonusActive, playSound, updatePile]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (gameStatus !== 'playing' || modal.type !== 'none' || isAutoPlay || isAiThinking || freeCardsRemaining > 0) return;

            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                setSelectedPileIndex(prev => {
                    if (prev === null) return 0;
                    const offset = e.key === 'ArrowLeft' ? -1 : 1;
                    return (prev + offset + piles.length) % piles.length;
                });
            }

            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                if (selectedPileIndex !== null && !piles[selectedPileIndex].locked) {
                    const direction = e.key === 'ArrowUp' ? 'higher' : 'lower';
                    makeGuess(selectedPileIndex, direction);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [gameStatus, modal.type, selectedPileIndex, makeGuess, piles, isAutoPlay, isAiThinking, freeCardsRemaining]);

    const handleGuessFromMouse = (pileIndex: number, direction: 'higher' | 'lower') => {
        setSelectedPileIndex(null);
        makeGuess(pileIndex, direction);
    };

    const handleUseJoker = useCallback(() => {
        if (jokerCount > 0 && piles.some(p => p.locked)) {
            const cardsPlayed = INITIAL_MAIN_PILE_SIZE - mainPile.length;
            if (isAutoPlay && isAiTurboMode && cardsPlayed < 10) {
                log("AI Mulligan: Early game bad luck detected. Restarting.", "warning");
                setTimeout(() => {
                    initializeGame();
                    setGameStatus("playing");
                    setIsAutoPlay(true);
                    setIsAiTurboMode(true);
                }, 1000);
                return;
            }
            
            playSound('jokerUsed');
            setJokerCount(c => c - 1);
            setGameStats(prev => ({ ...prev, jokersUsed: prev.jokersUsed + 1 }));
            
            // Rule: Clear and reset all piles
            log("Joker used! All piles cleared and reset.", "success");
            
            const cardsNeeded = 3;
            if (mainPile.length < cardsNeeded) {
                log("Not enough cards to fully reset piles!", "warning");
            }
            
            const newCardsForPiles = mainPile.slice(0, cardsNeeded);
            setMainPile(p => p.slice(cardsNeeded));

            const newPiles: PileState[] = Array(3).fill(null).map((_, index) => ({
                cards: newCardsForPiles[index] ? [newCardsForPiles[index]] : [],
                locked: false,
                lockedByJack: false
            }));
            setPiles(newPiles);
        }
    }, [jokerCount, piles, playSound, log, mainPile.length, isAutoPlay, isAiTurboMode, initializeGame]);
    
    const handleFinalGuess = useCallback((rankGuess: string, suitGuess: Suit | "") => {
        setModal({ type: 'none' });
        log(`Your final guess: ${rankGuess}${suitGuess ? ` of ${suitGuess}` : ''}. The card was: ${getCardDisplay(finalRandomCard!)}`, "info");
        if (finalRandomCard && RANKS[finalRandomCard.rank] === rankGuess && (!suitGuess || finalRandomCard.suit === suitGuess)) {
            playSound('winOverride');
            setGameStatus('won');
            const message = `Victory! You correctly guessed the ${getCardDisplay(finalRandomCard)}.` + (suitGuess ? " A perfect guess!" : "");
            setWinLossMessage(message);
            recordCompletedGame("Win - Correct final guess");
        } else {
            if (jokerCount > 0 && !isAutoPlay) {
                setModal({ type: 'jokerFinalGuess' });
            } else {
                setGameStatus('lost');
                setWinLossMessage(`Final guess incorrect. The card was the ${getCardDisplay(finalRandomCard!)}.`);
                recordCompletedGame("Loss - Incorrect final guess");
            }
        }
    }, [finalRandomCard, jokerCount, playSound, log, recordCompletedGame, isAutoPlay]);
    
    const resetGame = useCallback(() => {
        if (gameStatus === 'playing') {
            recordCompletedGame("Game reset by player");
        }
        initializeGame();
        setGameStatus("not-started");
    }, [gameStatus, recordCompletedGame, initializeGame]);
    
    // --- AI LOGIC ---
    useEffect(() => {
        const speedMultiplier = isAiTurboMode ? 2.5 : 1;
        const canAiAct = isAutoPlay && !isAiThinking && gameStatus === 'playing' && modal.type === 'none';

        if (!canAiAct) return;

        let aiTimer: ReturnType<typeof setTimeout>;
        
        // Scenario 1: AI must use a Joker if all piles are locked (HIGHEST PRIORITY)
        if (piles.every(p => p.locked)) {
            if (jokerCount > 0) {
                setIsAiThinking(true);
                aiTimer = setTimeout(() => {
                    log("AI uses a Joker to unlock all piles.", "info");
                    handleUseJoker();
                    setAiConfidence(0);
                    setIsAiThinking(false);
                }, 750 / speedMultiplier);
            }
            // else: no jokers, do nothing, game over useEffect will trigger the loss.
        }
        // Scenario 2: AI must place free cards
        else if (freeCardsRemaining > 0) {
            setIsAiThinking(true);
            aiTimer = setTimeout(() => {
                const availablePiles = piles.map((p, i) => ({ ...p, index: i })).filter(p => !p.locked);
                if (availablePiles.length > 0) {
                    // Simple AI: place on the pile with the fewest cards to spread risk
                    const targetPile = availablePiles.sort((a, b) => a.cards.length - b.cards.length)[0];
                    log(`AI places a free card on Pile ${targetPile.index + 1}.`, "info");
                    handleFreeCardPlacement(targetPile.index);
                } else {
                    log("AI has free cards but no unlocked piles. Forfeiting remaining free cards.", "warning");
                    setFreeCardsRemaining(0);
                }
                setIsAiThinking(false);
            }, 500 / speedMultiplier);
        }
        // Scenario 3: Normal guess or final guess
        else {
            const performAiMove = () => {
                setIsAiThinking(true);

                // Final Guess
                if (mainPile.length === 0) {
                    const guess = RANKS[Math.floor(Math.random() * RANKS.length)];
                    log(`AI makes its final guess for the stolen card: ${guess}.`, "info");
                    setTimeout(() => handleFinalGuess(guess, ""), 1500 / speedMultiplier);
                    return;
                }

                let bestMove = { pileIndex: -1, direction: '' as 'higher' | 'lower', certainty: -1 };
                
                piles.forEach((pile, index) => {
                    if (!pile.locked) {
                        const topCard = pile.cards.slice(-1)[0];
                        const value = cardValue(topCard);
                        let currentCertainty = 0;
                        let currentDirection: 'higher' | 'lower' = 'higher';

                        if (value <= 1) { // Ace
                            currentCertainty = 1; currentDirection = 'higher';
                        } else if (value >= 13) { // King
                            currentCertainty = 1; currentDirection = 'lower';
                        } else {
                            const higher_prob = (13 - value) / 12.0;
                            const lower_prob = (value - 2) / 12.0;
                            
                            if(higher_prob >= lower_prob){
                                currentCertainty = higher_prob; currentDirection = 'higher';
                            } else {
                                currentCertainty = lower_prob; currentDirection = 'lower';
                            }
                        }
                        
                        if (currentCertainty > bestMove.certainty) {
                            bestMove = { pileIndex: index, direction: currentDirection, certainty: currentCertainty };
                        }
                    }
                });

                setAiConfidence(bestMove.certainty > 0 ? bestMove.certainty : 0);

                setTimeout(() => {
                    if (bestMove.pileIndex !== -1) {
                        log(`AI chooses to guess '${bestMove.direction}' on Pile ${bestMove.pileIndex + 1}.`, "info");
                        setAiAction({ pileIndex: bestMove.pileIndex, direction: bestMove.direction });
                        setTimeout(() => {
                            makeGuess(bestMove.pileIndex, bestMove.direction);
                            setAiAction(null);
                            setAiConfidence(0);
                            setIsAiThinking(false);
                        }, 800 / speedMultiplier);
                    } else {
                        log("AI has no valid moves.", "warning");
                        setIsAiThinking(false);
                    }
                }, 1500 / speedMultiplier);
            };
            aiTimer = setTimeout(performAiMove, 500 / speedMultiplier);
        }
        
        return () => clearTimeout(aiTimer);

    }, [isAutoPlay, isAiThinking, gameStatus, piles, mainPile.length, modal.type, jokerCount, isAiTurboMode, freeCardsRemaining, log, handleFreeCardPlacement, handleUseJoker, handleFinalGuess, makeGuess]);


    // Modal Content
    const renderModalContent = () => {
        if (modal.type === 'none') return null;

        const handleClose = () => setModal({ type: 'none' });
        
        switch (modal.type) {
            case 'settings':
                return <Modal onClose={handleClose}>
                    <h2>Settings</h2>
                    <div className="space-y-6 text-xl my-8">
                        <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-white/10 transition-colors">
                            <span>Enable Sound Effects</span>
                            <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} className="h-6 w-6 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500" />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-white/10 transition-colors">
                            <span>Enable Music</span>
                            <input type="checkbox" checked={musicEnabled} onChange={e => setMusicEnabled(e.target.checked)} className="h-6 w-6 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500" />
                        </label>
                        <label className="flex items-center justify-between cursor-pointer p-2 rounded hover:bg-white/10 transition-colors">
                            <span>Show Timestamps in Log</span>
                            <input type="checkbox" checked={showTimestamps} onChange={e => setShowTimestamps(e.target.checked)} className="h-6 w-6 text-red-600 bg-gray-800 border-gray-600 rounded focus:ring-red-500" />
                        </label>
                    </div>
                    <button onClick={handleClose} className="mt-6 btn btn-primary">Close</button>
                </Modal>;
            case 'rules':
                return <Modal onClose={handleClose}>
                    <h2>Bloodjack Rules</h2>
                    <div className="space-y-3">
                        <p><strong>Objective:</strong> Deplete the main deck and guess the final hidden card's rank to win.</p>
                        <p><strong>Gameplay:</strong> For each of the three piles, guess if the next card from the deck is higher or lower than the top card of the pile. An incorrect guess locks that pile.</p>
                        <p><strong>Special Cards:</strong> Aces discard a pile and restart it. Jacks lock piles. Kings, Queens, and Tens trigger unique events and gambles. See the Lore section for more details.</p>
                        <p><strong>Endgame:</strong> When the deck is empty, you must guess the hidden card. Use Jokers to clear all locked piles or for a second chance at the final guess.</p>
                    </div>
                    <button onClick={handleClose} className="mt-6 btn btn-primary">Got it!</button>
                </Modal>;
            case 'lore':
                 return <Modal onClose={handleClose}>
                     <h2>The Cards of Fate</h2>
                     <div className="space-y-3 text-lg">
                        <p><strong>The Ace:</strong> A cleansing force. It erases a pile, offering a fresh start from the deck.</p>
                        <p><strong>The Jack:</strong> The Jailer. It seals a pile it lands on. Three Jack-sealed piles means instant defeat.</p>
                        <p><strong>The Queen:</strong> The Benefactor. Her arrival grants you two "free" card placements, no guess required.</p>
                        <p><strong>The King:</strong> The Noble. If he's the first royal in a pile, you may guess if the next card is also royalty (Q, K) for a reward. If he joins a Queen, their union grants five free placements.</p>
                        <p><strong>The Ten:</strong> The Trickster. It offers a wager: guess the next card's rank to gain a Joker, or its suit to clear the pile. Guess wrong, and the pile locks.</p>
                     </div>
                     <button onClick={handleClose} className="mt-6 btn btn-primary">Close</button>
                 </Modal>;
            case 'royaltyGuess':
                return <Modal onClose={handleClose}>
                    <h2 className="mb-2">A Noble's Wager</h2>
                    <p className="mb-4 text-lg">The King has arrived. Do you predict the next card from the deck will be Royalty (a Queen or King)?</p>
                    <div className="flex gap-4 mt-8 justify-center">
                        <button onClick={() => handleRoyaltyGuess(modal.data!.pileIndex!, true)} className="btn btn-primary">Yes, Royalty</button>
                        <button onClick={() => handleRoyaltyGuess(modal.data!.pileIndex!, false)} className="btn btn-secondary">No, Commoner</button>
                    </div>
                </Modal>;
            case 'trickster':
                const pileIdx = modal.data?.pileIndex ?? 0;
                return <Modal onClose={() => handleTricksterGuess(pileIdx, {})}>
                    <h2 className="mb-2">The Trickster's Gamble</h2>
                    <p className="mb-6 text-lg">The 10 appears. You may guess the next card's rank, suit, or both. Or, you can decline.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const rank = (e.currentTarget.elements.namedItem('rank') as HTMLSelectElement).value;
                        const suit = (e.currentTarget.elements.namedItem('suit') as HTMLSelectElement).value as Suit;
                        handleTricksterGuess(pileIdx, { rank: rank || undefined, suit: suit || undefined });
                    }} className="space-y-4">
                        <p>Guess rank to gain a Joker. Guess suit to clear this pile. Guess both correctly for both rewards. Any incorrect guess locks this pile!</p>
                        <div className="flex gap-4">
                            <select name="rank" className="flex-1 bg-gray-800 border border-gray-600 text-white text-lg p-3 rounded-md">
                                <option value="">- Guess Rank -</option>
                                {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <select name="suit" className="flex-1 bg-gray-800 border border-gray-600 text-white text-lg p-3 rounded-md">
                                <option value="">- Guess Suit -</option>
                                {SUITS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                            </select>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button type="submit" className="btn btn-primary flex-1">Submit Guess</button>
                            <button type="button" onClick={() => handleTricksterGuess(pileIdx, {})} className="btn btn-secondary flex-1">Decline</button>
                        </div>
                    </form>
                </Modal>;
            case 'unlockPile':
                const unlockable = modal.data?.unlockablePiles ?? [];
                return <Modal onClose={handleClose}>
                    <h2 className="mb-2">Bloodsurge Bonus</h2>
                    <p className="mb-6 text-lg">The matching suits allow you to unlock one pile that wasn't locked by a Jack. Choose one:</p>
                    <div className="flex flex-wrap gap-4 justify-center">
                        {unlockable.map(idx => (
                            <button key={idx} onClick={() => handleUnlockPileChoice(idx)} className="btn btn-primary">
                                Unlock Pile {idx + 1}
                            </button>
                        ))}
                    </div>
                </Modal>;
            case 'finalGuess':
                return <Modal onClose={handleClose}>
                    <h2 className="mb-2">The Final Guess</h2>
                    <p className="mb-4">The deck is empty. Name the hidden card to win. Guessing the suit is optional, but grants bonus glory.</p>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const rank = (e.currentTarget.elements.namedItem('rank') as HTMLSelectElement).value;
                        const suit = (e.currentTarget.elements.namedItem('suit') as HTMLSelectElement).value as Suit | "";
                        handleFinalGuess(rank, suit);
                    }} className="flex items-center justify-center mt-6">
                        <select name="rank" className="bg-gray-800 border border-gray-600 text-white text-lg p-3 rounded-md mr-4">
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select name="suit" className="bg-gray-800 border border-gray-600 text-white text-lg p-3 rounded-md mr-4">
                            <option value="">--Suit (Optional)--</option>
                            {SUITS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                        </select>
                        <button type="submit" className="btn btn-primary">Submit</button>
                    </form>
                </Modal>;
            case 'jokerFinalGuess':
                 return <Modal onClose={handleClose}>
                     <h2 className="mb-2">Second Chance?</h2>
                     <p className="mb-4">Your guess was incorrect. You have {jokerCount} Joker(s) remaining. Spend one for another guess?</p>
                     <div className="flex gap-4 mt-4">
                         <button onClick={() => { setJokerCount(c => c-1); setGameStats(prev => ({ ...prev, jokersUsed: prev.jokersUsed + 1 })); setModal({type: 'finalGuess'}); }} className="btn btn-primary">Yes, use Joker</button>
                         <button onClick={() => { handleClose(); setGameStatus('lost'); setWinLossMessage('Final guess incorrect.'); recordCompletedGame("Loss - Incorrect final guess"); }} className="btn btn-secondary">No, accept fate</button>
                     </div>
                 </Modal>;
            default:
                return null;
        }
    };
    
    const intensity = gameStatus === 'playing' ? 1 - (mainPile.length / INITIAL_MAIN_PILE_SIZE) : 0;
    let mood: 'calm' | 'tense' | 'euphoric' | 'danger' = 'calm';

    if (gameStatus === 'playing') {
        if (correctStreak > 2) mood = 'euphoric';
        else if (incorrectStreak > 1) mood = 'danger';
        else if (intensity > 0.6) mood = 'tense';
    }
    
    const isSpecialTip = gameStatus === 'playing' && !isTipsCollapsed && displayTips[currentTipIndex]?.includes("Arrow Keys") && !isAutoPlay;

    let confidenceStyles = { bar: 'from-yellow-500 to-amber-300', text: 'text-amber-300', border: 'border-yellow-800/50', pulseText: 'text-yellow-300' };
    if (isAutoPlay) {
        if (aiConfidence < 0.6) confidenceStyles = { bar: 'from-red-600 to-orange-500', text: 'text-orange-400', border: 'border-red-800/50', pulseText: 'text-orange-400' };
        else if (aiConfidence >= 0.85) confidenceStyles = { bar: 'from-green-500 to-lime-400', text: 'text-lime-300', border: 'border-green-800/50', pulseText: 'text-lime-300' };
    }

    return (
        <div className="isolate bg-gradient-to-br from-red-950/95 via-gray-900/95 to-black/95 min-h-screen p-2 sm:p-6 md:p-8">
            <AnimatedBackground gameStatus={gameStatus} intensity={intensity} mood={mood} pulse={backgroundPulse ?? undefined} />
            <div className="max-w-6xl mx-auto text-center">

                {gameStatus === 'not-started' && (
                    <div className="fixed inset-0 bg-black bg-opacity-90 flex flex-col items-center justify-center z-40 p-4">
                        <img src="https://deffy.me/Bloodjack/imgs/bloodjack-name.png" alt="Bloodjack" className="max-w-xs md:max-w-lg h-auto mb-10 drop-shadow-[0_2px_10px_rgba(255,0,0,0.5)]"/>
                        <button onClick={startGame} className="btn btn-primary text-2xl md:text-3xl mb-6 shadow-lg shadow-red-500/30">
                            Start Game
                        </button>
                        <button onClick={() => setModal({ type: 'rules' })} className="btn btn-secondary">
                            Rules
                        </button>
                    </div>
                )}

                <audio ref={audioRefs.bloodlock} id="bloodlockSound" />
                <audio ref={audioRefs.jokerUsed} id="jokerUsedSound" />
                <audio ref={audioRefs.lastCard} id="lastCardSound" />
                <audio ref={audioRefs.bloodsurge} id="bloodsurgeSound" />
                <audio ref={audioRefs.aceReset} id="aceResetSound" />
                <audio ref={audioRefs.winOverride} id="winOverrideSound" />
                <audio ref={audioRefs.music} id="musicSound" />

                <header className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 md:gap-0 pb-4 border-b border-b-red-900/50">
                    <img src="https://deffy.me/Bloodjack/imgs/bloodjack-name.png" alt="Bloodjack" className="header-logo"/>
                    <div className="flex items-center gap-2 md:gap-4">
                        <button 
                            onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                                const willBeOn = !isAutoPlay;
                                setIsAutoPlay(willBeOn);
                                if (willBeOn) {
                                    if (e.ctrlKey) { setIsAiTurboMode(true); log("AI Turbo Mode Activated!", "warning"); }
                                } else { setIsAiTurboMode(false); }
                            }} 
                            className={`btn ${isAutoPlay ? (isAiTurboMode ? 'btn-turbo-glow' : 'btn-primary animate-pulse') : 'btn-secondary'}`} 
                            disabled={gameStatus !== 'playing'}
                        >
                            {isAutoPlay ? `AI Active${isAiTurboMode ? ' (Turbo)' : ''}` : 'Auto-Play AI'}
                        </button>
                        <button onClick={() => setModal({ type: 'lore' })} className="btn btn-secondary">Lore</button>
                        <button onClick={() => setModal({ type: 'rules' })} className="btn btn-secondary">Rules</button>
                        <button onClick={() => setModal({ type: 'settings' })} className="btn btn-secondary p-2 md:p-3" aria-label="Settings">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                    </div>
                </header>
                
                <div className={`panel-inset my-4 !p-0 transition-all duration-500 ${isSpecialTip ? 'special-tip-glow' : ''}`}>
                    <header 
                        className="flex justify-between items-center cursor-pointer p-2 hover:bg-white/5 rounded-md transition-colors"
                        onClick={() => setIsTipsCollapsed(!isTipsCollapsed)} aria-expanded={!isTipsCollapsed} aria-controls="tips-panel-content"
                    >
                        <h3 className="text-red-400 font-bold text-lg tracking-wider pl-4">
                           {isAutoPlay ? "AI Analysis" : freeCardsRemaining > 0 ? "Free Placement" : mainPile.length === 0 ? "Status Update" : "Game Tips"}
                        </h3>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 text-gray-400 transition-transform duration-300 ${isTipsCollapsed ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </header>
                    <div id="tips-panel-content" className={`tips-content ${isTipsCollapsed ? 'tips-content-collapsed' : ''}`}>
                        {isAutoPlay ? (
                            <div className="px-2 space-y-2">
                                <p className={`text-center text-lg md:text-xl ${confidenceStyles.pulseText} animate-pulse`}>
                                    {isAiThinking ? "AI is Thinking..." : "AI is waiting..."}
                                </p>
                                <div className="flex items-center gap-4">
                                    <div className={`flex-grow w-full bg-gray-900 rounded-full h-5 border-2 ${confidenceStyles.border} shadow-inner overflow-hidden`}>
                                        <div className={`bg-gradient-to-r ${confidenceStyles.bar} h-full rounded-full transition-all duration-500 ease-out`} style={{ width: `${aiConfidence * 100}%` }} />
                                    </div>
                                    <div className={`text-xl md:text-2xl font-bold ${confidenceStyles.text}`} style={{ fontFamily: "'Cinzel Decorative', cursive", textShadow: '0 0 8px currentColor' }}>
                                        {(aiConfidence * 100).toFixed(0)}%
                                    </div>
                                </div>
                                <p className="text-center text-sm text-gray-400 -mt-1">Confidence Meter</p>
                            </div>
                        ) : freeCardsRemaining > 0 ? (
                            <p className="text-center text-lg md:text-2xl px-2 animate-fade-in text-blue-300">
                                Click a pile to place your free card. ({freeCardsRemaining} remaining)
                            </p>
                        ) : (
                            <p key={mainPile.length === 0 ? 'final' : displayTips[currentTipIndex]} className="text-center text-lg md:text-2xl px-2 animate-fade-in">
                                {mainPile.length === 0 ? "The final guess is imminent!" : displayTips[currentTipIndex]}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6 mb-8">
                    <div title="Main Pile" className="deck-count-text">
                        {mainPile.length}
                    </div>
                    <div className="w-full progress-bar-container-inset">
                        <div className="progress-bar-fill-pulsing" style={{ width: `${(mainPile.length / INITIAL_MAIN_PILE_SIZE) * 100}%` }} />
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={handleUseJoker} disabled={jokerCount <= 0 || !piles.some(p => p.locked) || isAutoPlay || isAiThinking} className={`btn btn-primary ${jokerCount > 0 && piles.some(p => p.locked) && !isAutoPlay ? 'btn-glow' : ''}`}>
                            {jokerCount > 0 ? `Use Joker (${jokerCount})` : 'No Jokers'}
                        </button>
                    </div>
                </div>

                <main className="flex flex-row justify-around items-center md:items-start mb-6 gap-2 md:gap-8">
                    {piles.map((pile, i) => (
                        <Pile 
                            key={i} 
                            pile={pile} 
                            pileIndex={i} 
                            onGuess={handleGuessFromMouse}
                            onPlaceFreeCard={handleFreeCardPlacement}
                            mainPileEmpty={mainPile.length === 0}
                            isSelected={selectedPileIndex === i}
                            isAiActive={isAutoPlay || isAiThinking}
                            aiAction={aiAction}
                            isFreePlacementMode={freeCardsRemaining > 0}
                        />
                    ))}
                </main>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left text-lg md:text-xl mb-6">
                    <div className={`panel-inset h-60 md:h-72 overflow-y-auto ${pastGamesHistory.length === 0 ? 'md:col-span-3' : 'md:col-span-1'}`}>
                        <div className="flex flex-col-reverse">
                            {gameLog.map((entry, i) => (
                                <p key={i} className={`my-1 px-1 rounded transition-colors duration-200 hover:bg-white/10 
                                    ${entry.type === 'success' ? 'text-green-400' :
                                      entry.type === 'warning' ? 'text-yellow-400' :
                                      entry.type === 'error' ? 'text-red-500' :
                                      'text-gray-300'}`}>
                                    {showTimestamps && `[${entry.timestamp}] `}{entry.message}
                                </p>
                            ))}
                        </div>
                    </div>
                    {pastGamesHistory.length > 0 && (
                        <div className="panel-inset max-h-72 overflow-y-auto md:col-span-2">
                            <h3 className="font-bold mb-1 text-red-400 text-2xl">Past Games History</h3>
                            {pastGamesHistory.map((entry, i) => <p key={i} className="text-gray-400">{entry}</p>)}
                        </div>
                    )}
                </div>
                
                <button onClick={resetGame} className="btn btn-secondary mt-6">
                    Reset Game
                </button>
                
                {gameStatus === 'won' && <VictoryScreen stats={gameStats} onPlayAgain={resetGame} message={winLossMessage} />}
                {gameStatus === 'lost' && (
                    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-40">
                        <div className="p-10 border-2 rounded-lg text-center bg-red-950 border-red-600">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Defeat!</h2>
                            <p className="text-lg md:text-xl mb-8">{winLossMessage}</p>
                            <button onClick={resetGame} className="btn btn-primary mt-8">Play Again</button>
                        </div>
                    </div>
                )}
                
                {renderModalContent()}

            </div>
        </div>
    );
}

export default App;