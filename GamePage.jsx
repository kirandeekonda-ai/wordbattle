import React, { useState, useEffect, useCallback, useRef } from "react";
import confetti from "canvas-confetti";
import socket from "./src/socket.ts";
/**
* WordBattle – Game (React)
* Visual layout corrected – grid now renders as a 10 × 15 square in all viewports.
* TailwindCSS (>= v3) with custom colours is assumed to be configured.
*/
/* ─── Constants ─────────────────────────────────────────── */
const ROWS = 10;
const COLS = 15;
const randLetter = () => String.fromCharCode(65 + (Math.random() * 26) | 0);
const coordKey = (r, c) => `${r}-${c}`;
export default function GamePage() {
  /* ── UIstate ─────────────────────────────────────────── */
  const [settings, setSettings] = useState({
    timer: 30,
    wordCount: 10,
    placement: 'horizontal',
  });
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "neon");
  // Use username from localStorage if available
  const [player] = useState(() => localStorage.getItem('wbUsername') || 'witty‑panda‑123');
  const [score, setScore] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(settings.timer);
  /* ── game state ──────────────────────────────────────── */
  const [matrix, setMatrix] = useState([]); // 2‑D char array
  const [placement, setPlacement] = useState(new Set()); // coords of current word
  const [found, setFound] = useState(new Set());
  const [flashRed, setFlashRed] = useState(null); // Track which cell flashes red
  const [gameOver, setGameOver] = useState(false);
  /* refs for latest values inside intervals */
  const timerRef = useRef(null);
  const placementRef = useRef(placement);
  const foundRef = useRef(found);
  const settingsRef = useRef(settings);
  const wordIdxRef = useRef(wordIdx);
  placementRef.current = placement;
  foundRef.current = found;
  settingsRef.current = settings;
  wordIdxRef.current = wordIdx;
  /* ── theme toggle ────────────────────────────────────── */
  const toggleTheme = () => {
    const next = theme === "neon" ? "light" : "neon";
    setTheme(next);
    localStorage.setItem("theme", next);
  };
  /* ── grid generation ─────────────────────────────────── */
  const buildGrid = useCallback((target, placementType) => {
    const upperTarget = target.toUpperCase();
    const temp = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    const posSet = new Set();
    // Only horizontal is supported for now
    if (placementType === 'horizontal') {
      const startC = Math.floor(Math.random() * (COLS - upperTarget.length));
      const row = Math.floor(Math.random() * ROWS);
      for (let i = 0; i < upperTarget.length; i++) {
        temp[row][startC + i] = upperTarget[i];
        posSet.add(coordKey(row, startC + i));
      }
    } else {
      // fallback to horizontal
      const startC = Math.floor(Math.random() * (COLS - upperTarget.length));
      const row = Math.floor(Math.random() * ROWS);
      for (let i = 0; i < upperTarget.length; i++) {
        temp[row][startC + i] = upperTarget[i];
        posSet.add(coordKey(row, startC + i));
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!temp[r][c]) temp[r][c] = randLetter();
      }
    }
    setMatrix(temp);
    setPlacement(posSet);
    setFound(new Set());
  }, []);
  // --- FIX: loadWord and startTimer now take words as parameter ---
  const loadWord = useCallback(
    (idx, placementType, timer, wordsArr) => {
      if (!settings || typeof settings.placement !== 'string' || typeof settings.timer !== 'number') return;
      if (!Array.isArray(wordsArr) || idx >= wordsArr.length) {
        setGameOver(true);
        return;
      }
      setWordIdx(idx);
      buildGrid(wordsArr[idx], placementType);
      setTimeLeft(timer);
    },
    [buildGrid, settings]
  );
  const startTimer = useCallback((wordsArr) => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(timerRef.current);
          // If not last word, go to next word; if last word, end game
          if (wordIdxRef.current + 1 < wordsArr.length) {
            loadWord(wordIdxRef.current + 1, settings.placement, settings.timer, wordsArr);
          } else {
            setGameOver(true);
          }
          return settingsRef.current && typeof settingsRef.current.timer === 'number' ? settingsRef.current.timer : 10;
        }
        return t - 1;
      });
    }, 1000);
  }, [loadWord, settings]);
  /* ── timer ──────────────────────────────────────────── */
  useEffect(() => {
    if (showSettings || !settings || typeof settings.timer !== 'number') return; // Don't run timer if modal is open or settings not ready
    startTimer(words);
    return () => clearInterval(timerRef.current);
  }, [wordIdx, settings, showSettings, startTimer, words]);
  /* ── initial load & shortcuts block ─────────────────── */
  useEffect(() => {
    const disableFind = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") e.preventDefault();
    };
    document.addEventListener("keydown", disableFind);
    return () => document.removeEventListener("keydown", disableFind);
  }, []);
  // Confetti celebration
  const celebrate = useCallback(() => {
    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.7 },
      startVelocity: 35,
      gravity: 0.7,
      scalar: 1.1,
      ticks: 200,
      colors: ["#38bdf8", "#fb7185", "#fbbf24", "#34d399", "#a78bfa"]
    });
  }, []);
  /* ── click handler ──────────────────────────────────── */
  const onCellClick = (pos) => {
    if (gameOver) return;
    if (placementRef.current.has(pos) && !foundRef.current.has(pos)) {
      const nextFound = new Set(foundRef.current);
      nextFound.add(pos);
      setFound(nextFound);
      if (nextFound.size === placementRef.current.size) {
        setScore((prev) => prev + 1); // Increment score only on word completion
        celebrate();
        setTimeout(() => {
          loadWord(wordIdxRef.current + 1, settings.placement, settings.timer, words);
        }, 900);
      }
    } else if (!placementRef.current.has(pos)) {
      setFlashRed(pos);
      setTimeout(() => setFlashRed(null), 300);
    }
  };
  const isCorrect = (pos) => found.has(pos);
  // Singleplayer Settings Modal State
  const [showSettings, setShowSettings] = useState(true);
  // Store the actual words for this session
  const [words, setWords] = useState([]);
  // When settings are confirmed, update words and timer, and start timer
  const handleStartGame = () => {
    // Request words from server
    socket.emit("getWords", { count: settings.wordCount });
    // The rest of the logic will run after words are received
  };
  // Play Again handler
  const handlePlayAgain = () => {
    setScore(0);
    setGameOver(false);
    setFound(new Set());
    setMatrix([]);
    setFlashRed(null);
    setShowSettings(true);
    setTimeLeft(settings.timer);
  };
  // Listen for words from server and start game
  useEffect(() => {
    function onWords({ words: receivedWords }) {
      if (!Array.isArray(receivedWords) || receivedWords.length === 0) return;
      setWords(receivedWords);
      setTimeLeft(settings.timer);
      setShowSettings(false);
      setGameOver(false);
      setScore(0);
      setFound(new Set());
      setMatrix([]);
      setFlashRed(null);
      setWordIdx(0); // Reset wordIdx to 0 on new game
      // Start first round after words are set
      setTimeout(() => {
        loadWord(0, settings.placement, settings.timer, receivedWords);
        startTimer(receivedWords);
      }, 0);
    }
    socket.on("words", onWords);
    return () => socket.off("words", onWords);
  }, [settings, loadWord, startTimer]);
  // Modal for settings
  function SettingsModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in pointer-events-auto">
        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] border-4 border-primary rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
          <h2 className="text-3xl md:text-4xl font-extrabold text-secondary mb-4 drop-shadow">Game Settings</h2>
          <div className="flex flex-col gap-6">
            <label className="text-left text-primary font-semibold">Word Count
              <select
                className="mt-1 w-full bg-[#0f172a] border border-primary text-primary font-semibold rounded px-3 py-2 shadow-neon focus:ring-2 focus:ring-secondary focus:border-secondary transition"
                value={settings.wordCount}
                onChange={e => setSettings(s => ({ ...s, wordCount: Number(e.target.value) }))}
              >
                {[3, 5, 10, 15, 20].map(v => <option key={v} value={v}>{v} Words</option>)}
              </select>
            </label>
            <label className="text-left text-primary font-semibold">Per-word Timer (seconds)
              <input
                type="range"
                min={10}
                max={90}
                step={1}
                value={settings.timer}
                onChange={e => setSettings(s => ({ ...s, timer: Number(e.target.value) }))}
                className="w-full h-3 rounded-full bg-[#1e293b] appearance-none focus:outline-none focus:ring-2 focus:ring-primary transition timer-slider"
                style={{ accentColor: theme === 'light' ? '#38bdf8' : '#fb7185' }}
              />
              <span className="ml-2 w-14 text-right font-mono text-primary text-base drop-shadow">⏱ {settings.timer}s</span>
            </label>
            <label className="text-left text-primary font-semibold">Word Placement
              <select
                className="mt-1 w-full bg-[#0f172a] border border-primary text-primary font-semibold rounded px-3 py-2 shadow-neon focus:ring-2 focus:ring-secondary focus:border-secondary transition"
                value={settings.placement}
                onChange={e => setSettings(s => ({ ...s, placement: e.target.value }))}
              >
                <option value="horizontal">Horizontal (left-to-right)</option>
                <option value="vertical" disabled>Vertical (coming soon)</option>
                <option value="diagonal" disabled>Diagonal (coming soon)</option>
              </select>
            </label>
            <button
              onClick={handleStartGame}
              className="mt-4 px-6 py-3 rounded-xl font-bold bg-primary/90 hover:bg-primary shadow-neon border border-primary/60 transition text-lg text-black"
            >
              Start Game
            </button>
          </div>
        </div>
      </div>
    );
  }
  // Game Over Result Card
  function ResultCard() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
        <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-primary animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-extrabold text-secondary mb-2">🎉 Game Over!</h2>
          <p className="text-lg md:text-xl font-semibold mb-4 text-primary">Final Score: <span className="text-secondary font-bold">{score}</span></p>
          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={handlePlayAgain}
              className="px-6 py-3 rounded-xl font-bold bg-primary/90 hover:bg-primary shadow-neon border border-primary/60 transition text-lg text-black"
            >
              Play Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 rounded-xl font-bold bg-secondary/90 hover:bg-secondary shadow-neon border border-secondary/60 transition text-lg text-black"
            >
              Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  /* ── tailwind helpers ───────────────────────────────── */
  const rootClasses = [
    "min-h-screen flex flex-col font-display text-gray-200",
    theme === "light"
      ? "bg-gradient-to-br from-[#f1f5f9] via-[#e7edf4] to-[#d9e4f2]"
      : "bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#1e293b]",
  ].join(" ");
  const cellBase =
    "flex items-center justify-center rounded font-semibold transition-colors select-none " +
    "w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12"; // fixed squarecells
  return (
    <div className={rootClasses}>
      {/* Blur and block pointer events only for the background, not the modal */}
      <div className={showSettings ? 'blur-md pointer-events-none select-none transition-all duration-300' : ''}>
        {/* ─── Navbar ─────────────────────────────────── */}
        <header className="sticky top-0 z-30 w-full bg-[#0f172a]/90 backdrop-blur ring-1 ring-white/5">
          <div className="max-w-7xl mx-auto grid grid-cols-[repeat(4,1fr)_auto] items-center gap-4 px-6 py-2 text-sm md:text-base">
            <span className="truncate">
              Player:&nbsp;<span className="font-bold text-primary">{player}</span>
            </span>
            <span className="text-center">
              Score:&nbsp;<span className="font-semibold text-secondary">{score}</span>
            </span>
            <span className="text-center">
              Time:&nbsp;<span className="font-semibold text-primary">{timeLeft}s</span>
            </span>
            <span className="text-center">
              Rounds:&nbsp;
              <span className="font-semibold text-primary">{wordIdx + 1}/{words.length}</span>
            </span>
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="justify-self-end w-10 h-10 flex items-center justify-center rounded-full bg-[#1e293b] hover:bg-[#334155] shadow-lg transition"
            >
              {theme === "neon" ? (
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M17.36 17.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M17.36 6.64l1.42-1.42" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </header>
        {/* ─── Target Word ─────────────────────────────── */}
        <section className="py-6">
          <h2 className="max-w-7xl mx-auto text-center text-3xl md:text-4xl font-semibold tracking-wide select-none">
            <span className="text-secondary mr-2">Find&nbsp;the&nbsp;Word:</span>
            <span className="text-primary font-extrabold tracking-widest">{words[wordIdx]?.toUpperCase()}</span>
          </h2>
        </section>
        {/* ─── Game Area ───────────────────────────────── */}
        <main className="flex-1 overflow-hidden">
          <div className="max-w-7xl mx-auto h-full px-4 md:px-6 pb-8 flex justify-center items-start">
            {/* Letter Grid */}
            <div className="flex justify-center flex-1 overflow-auto">
              <div className="grid gap-[4px]" style={{ gridTemplateColumns: `repeat(${COLS},minmax(0,1fr))`, maxWidth: "calc(var(--cell) * 15 + 56px)" }}>
                {matrix.map((row, rIdx) =>
                  row.map((char, cIdx) => {
                    const pos = coordKey(rIdx, cIdx);
                    const correct = isCorrect(pos);
                    const isFlashingRed = flashRed === pos;
                    return (
                      <button
                        key={pos}
                        onClick={() => onCellClick(pos)}
                        className={`${cellBase} ${correct
                            ? "bg-emerald-500 text-black shadow-neon"
                            : isFlashingRed
                              ? "bg-red-500 animate-pulse text-white"
                              : "bg-[#1e293b] hover:bg-[#334155] active:scale-95"
                          }`}
                      >
                        {char}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </main>
        <footer className="py-3 text-center text-xs text-gray-400">Click any letter that belongs to the target word – wrong picks flash red.</footer>
      </div>
      {/* Render modal OUTSIDE the blurred/pointer-events-none wrapper so it is always interactive */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 animate-fade-in pointer-events-auto">
          <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] border-4 border-primary rounded-3xl shadow-2xl p-8 max-w-md w-full text-center">
            <h2 className="text-3xl md:text-4xl font-extrabold text-secondary mb-4 drop-shadow">Game Settings</h2>
            <div className="flex flex-col gap-6">
              <label className="text-left text-primary font-semibold">Word Count
                <select
                  className="mt-1 w-full bg-[#0f172a] border border-primary text-primary font-semibold rounded px-3 py-2 shadow-neon focus:ring-2 focus:ring-secondary focus:border-secondary transition"
                  value={settings.wordCount}
                  onChange={e => setSettings(s => ({ ...s, wordCount: Number(e.target.value) }))}
                >
                  {[3, 5, 10, 15, 20].map(v => <option key={v} value={v}>{v} Words</option>)}
                </select>
              </label>
              <label className="text-left text-primary font-semibold">Per-word Timer (seconds)
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={1}
                  value={settings.timer}
                  onChange={e => setSettings(s => ({ ...s, timer: Number(e.target.value) }))}
                  className="w-full h-3 rounded-full bg-[#1e293b] appearance-none focus:outline-none focus:ring-2 focus:ring-primary transition timer-slider"
                  style={{ accentColor: theme === 'light' ? '#38bdf8' : '#fb7185' }}
                />
                <span className="ml-2 w-14 text-right font-mono text-primary text-base drop-shadow">⏱ {settings.timer}s</span>
              </label>
              <label className="text-left text-primary font-semibold">Word Placement
                <select
                  className="mt-1 w-full bg-[#0f172a] border border-primary text-primary font-semibold rounded px-3 py-2 shadow-neon focus:ring-2 focus:ring-secondary focus:border-secondary transition"
                  value={settings.placement}
                  onChange={e => setSettings(s => ({ ...s, placement: e.target.value }))}
                >
                  <option value="horizontal">Horizontal (left-to-right)</option>
                  <option value="vertical" disabled>Vertical (coming soon)</option>
                  <option value="diagonal" disabled>Diagonal (coming soon)</option>
                </select>
              </label>
              <button
                onClick={handleStartGame}
                className="mt-4 px-6 py-3 rounded-xl font-bold bg-primary/90 hover:bg-primary shadow-neon border border-primary/60 transition text-lg text-black"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      )}
      {gameOver && <ResultCard />}
    </div>
  );
}