import React, { useState, useEffect, useCallback, useRef } from "react";
/**
 * WordBattle – Game (React)
 * Visual layout corrected – grid now renders as a 10 × 15 square in all viewports.
 * TailwindCSS (>= v3) with custom colours is assumed to be configured.
 */
/* ─── Constants ─────────────────────────────────────────── */
const ROWS = 10;
const COLS = 15;
const WORDS = [
  "CASUAL",
  "WIZARD",
  "FOX",
  "NINJA",
  "KNIGHT",
  "OWL",
  "SCRIBE",
  "SPHINX",
  "BRAVE",
  "EPIC",
];
const randLetter = () => String.fromCharCode((65 + Math.random() * 26) | 0);
const coordKey = (r, c) => `${r}-${c}`;
export default function GamePage() {
  /* ── UIstate ─────────────────────────────────────────── */
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "neon"
  );
  // Use username from localStorage if available
  const [player] = useState(
    () => localStorage.getItem("wbUsername") || "witty‑panda‑123"
  );
  const [score, setScore] = useState(0);
  const [wordIdx, setWordIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  /* ── game state ──────────────────────────────────────── */
  const [matrix, setMatrix] = useState([]); // 2‑D char array
  const [placement, setPlacement] = useState(new Set()); // coords of current word
  const [found, setFound] = useState(new Set());
  const [flashRed, setFlashRed] = useState(null); // Track which cell flashes red
  /* refs for latest values inside intervals */
  const timerRef = useRef(null);
  const placementRef = useRef(placement);
  const foundRef = useRef(found);
  placementRef.current = placement;
  foundRef.current = found;
  /* ── theme toggle ────────────────────────────────────── */
  const toggleTheme = () => {
    const next = theme === "neon" ? "light" : "neon";
    setTheme(next);
    localStorage.setItem("theme", next);
  };
  /* ── grid generation ─────────────────────────────────── */
  const buildGrid = useCallback((target) => {
    const temp = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    const posSet = new Set();
    const startC = Math.floor(Math.random() * (COLS - target.length));
    const row = Math.floor(Math.random() * ROWS);
    for (let i = 0; i < target.length; i++) {
      temp[row][startC + i] = target[i];
      posSet.add(coordKey(row, startC + i));
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
  /* ── load / next word ───────────────────────────────── */
  const loadWord = useCallback(
    (idx) => {
      if (idx >= WORDS.length) {
        clearInterval(timerRef.current);
        alert("Round complete! 🎉");
        return;
      }
      setWordIdx(idx);
      buildGrid(WORDS[idx]);
      setTimeLeft(30);
    },
    [buildGrid]
  );
  const nextWord = useCallback(
    () => loadWord(wordIdx + 1),
    [loadWord, wordIdx]
  );
  /* ── timer ──────────────────────────────────────────── */
  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(timerRef.current);
          nextWord();
          return 30;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [wordIdx, nextWord]);
  /* ── initial load & shortcuts block ─────────────────── */
  useEffect(() => {
    loadWord(0);
    const disableFind = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f")
        e.preventDefault();
    };
    document.addEventListener("keydown", disableFind);
    return () => document.removeEventListener("keydown", disableFind);
  }, [loadWord]);
  /* ── click handler ──────────────────────────────────── */
  const onCellClick = (pos) => {
    if (placementRef.current.has(pos) && !foundRef.current.has(pos)) {
      const nextFound = new Set(foundRef.current);
      nextFound.add(pos);
      setFound(nextFound);
      if (nextFound.size === placementRef.current.size) {
        setScore((s) => s + 1);
        nextWord();
      }
    } else if (!placementRef.current.has(pos)) {
      setFlashRed(pos);
      setTimeout(() => setFlashRed(null), 300);
    }
  };
  const isCorrect = (pos) => found.has(pos);
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
      {/* ─── Navbar ─────────────────────────────────── */}
      <header className="sticky top-0 z-30 w-full bg-[#0f172a]/90 backdrop-blur ring-1 ring-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-[repeat(4,1fr)_auto] items-center gap-4 px-6 py-2 text-sm md:text-base">
          <span className="truncate">
            Player:&nbsp;
            <span className="font-bold text-primary">{player}</span>
          </span>
          <span className="text-center">
            Score:&nbsp;
            <span className="font-semibold text-secondary">{score}</span>
          </span>
          <span className="text-center">
            Time:&nbsp;
            <span className="font-semibold text-primary">{timeLeft}s</span>
          </span>
          <span className="text-center">
            {wordIdx + 1}&nbsp;/&nbsp;{WORDS.length}
          </span>
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="justify-self-end w-10 h-10 flex items-center justify-center rounded-full bg-[#1e293b] hover:bg-[#334155] shadow-lg transition"
          >
            {theme === "neon" ? (
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5 text-yellow-400"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="5" />
                <path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M17.36 17.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M17.36 6.64l1.42-1.42"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>
      </header>
      {/* ─── Target Word ─────────────────────────────── */}
      <section className="py-6">
        <h2 className="max-w-7xl mx-auto text-center text-3xl md:text-4xl font-semibold tracking-wide select-none">
          <span className="text-secondary mr-2">Find&nbsp;the&nbsp;Word:</span>
          <span className="text-primary font-extrabold tracking-widest">
            {WORDS[wordIdx]}
          </span>
        </h2>
      </section>
      {/* ─── Game Area ───────────────────────────────── */}
      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto h-full px-4 md:px-6 pb-8 grid lg:grid-cols-[1fr_17rem] gap-8 lg:gap-12 items-start">
          {/* Letter Grid */}
          <div className="flex justify-center flex-1 overflow-auto order-1 lg:order-none">
            <div
              className="grid gap-[4px]"
              style={{
                gridTemplateColumns: `repeat(${COLS},minmax(0,1fr))`,
                maxWidth: "calc(var(--cell) * 15 + 56px)",
              }}
            >
              {matrix.map((row, rIdx) =>
                row.map((char, cIdx) => {
                  const pos = coordKey(rIdx, cIdx);
                  const correct = isCorrect(pos);
                  const isFlashingRed = flashRed === pos;
                  return (
                    <button
                      key={pos}
                      onClick={() => onCellClick(pos)}
                      className={`${cellBase} ${
                        correct
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
          {/* Scoreboard (desktop) */}
          <aside className="hidden lg:block bg-[#111827]/90 ring-1 ring-white/10 rounded-xl p-4 h-fit min-w-[200px] order-2 lg:order-none">
            <h3 className="text-center text-gray-100 font-bold mb-3 border-b border-white/10 pb-2">
              Scoreboard
            </h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between px-1">
                <span>{player}</span>
                <span className="font-semibold">{score}</span>
              </li>
            </ul>
          </aside>
        </div>
      </main>
      <footer className="py-3 text-center text-xs text-gray-400">
        Click any letter that belongs to the target word – wrong picks flash
        red.
      </footer>
    </div>
  );
}
