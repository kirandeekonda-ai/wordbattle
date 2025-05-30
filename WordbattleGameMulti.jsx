import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import socket from "./src/socket.ts";
/**
 * WordBattle – Multiplayer Game Page (React)
 * Follows the Midnight‑Neon theme and adds a dynamic scoreboard where each
 * player is rendered as a card that automatically reorders (animated) as
 * scores change. Replace the mock WebSocket logic with your real socket events.
 *
 * URL params expected: ?player=NAME&room=CODE (optional
 */
/* ——————————————————— Constants ——————————————————— */
const ROWS = 10;
const COLS = 15;
const randLetter = () => String.fromCharCode((65 + Math.random() * 26) | 0);
const ck = (r, c) => `${r}-${c}`;
const useQuery = () =>
  Object.fromEntries(new URLSearchParams(window.location.search));
/* ——————————————————— Component ——————————————————— */
const getPlayerName = () => localStorage.getItem("wbUsername") || "Player";
export default function MultiplayerGame() {
  // Use actual player name from localStorage
  const query = useQuery();
  const roomCode = query.room;
  const playerName = getPlayerName();
  const navigate = useNavigate();
  /* —— Theme —— */
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "neon"
  );
  const toggleTheme = () => {
    const nxt = theme === "neon" ? "light" : "neon";
    setTheme(nxt);
    localStorage.setItem("theme", nxt);
  };
  useLayoutEffect(() => {
    document.body.classList.toggle(
      "bg-gradient-to-br",
      true /* keep util for both modes */
    );
  }, []);
  /* —— Game / Grid —— */
  const [wordIdx, setWordIdx] = useState(0);
  const [matrix, setMatrix] = useState([]);
  const [placement, setPlacement] = useState(new Set());
  const [found, setFound] = useState(new Set());
  const [flash, setFlash] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [rounds, setRounds] = useState(1);
  const [timer, setTimer] = useState(30);
  const timerRef = useRef(null);
  // Track if game settings have been received
  // const [gameReady, setGameReady] = useState(false);
  /* —— Players & Scores —— */
  const [players, setPlayers] = useState(() => [
    { id: 1, name: playerName, score: 0, you: true },
  ]);
  // Add state for game over
  const [gameOver, setGameOver] = useState(false);
  // Add state for words
  const [WORDS, setWORDS] = useState([]);
  // Helper to build grid with word placed according to allowed directions
  const buildGrid = (target, placementType = "Any") => {
    console.log("[LOG] buildGrid called", { target, placementType });
    // Normalize allowed directions from placementType (array or string)
    let allowed = [];
    if (Array.isArray(placementType)) {
      allowed = placementType
        .map((dir) => {
          if (typeof dir !== "string") return null;
          const d = dir.trim().toLowerCase();
          if (d === "horizontal") return "horizontal";
          if (d === "vertical") return "vertical";
          if (d === "diagonal") return "diagonal";
          return null;
        })
        .filter(Boolean);
    } else if (typeof placementType === "string") {
      const placementStr = placementType.trim().toLowerCase();
      if (placementStr === "any") {
        allowed = ["horizontal", "vertical", "diagonal"];
      } else {
        allowed = placementStr
          .split(",")
          .map((s) => {
            const dir = s.trim().toLowerCase();
            if (dir === "horizontal") return "horizontal";
            if (dir === "vertical") return "vertical";
            if (dir === "diagonal") return "diagonal";
            return null;
          })
          .filter(Boolean);
      }
    }
    // Fallback: if nothing valid, allow all
    if (allowed.length === 0) allowed = ["horizontal", "vertical", "diagonal"];
    // Pick a direction only from allowed
    const direction = allowed[Math.floor(Math.random() * allowed.length)];
    // DEBUG: log allowed and picked direction
    console.log("[DEBUG] Allowed directions:", allowed, "Picked:", direction);
    const temp = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
    let posSet = new Set();
    let startR, startC;
    if (direction === "horizontal") {
      startR = Math.floor(Math.random() * ROWS);
      startC = Math.floor(Math.random() * (COLS - target.length));
      for (let i = 0; i < target.length; i++) {
        temp[startR][startC + i] = target[i];
        posSet.add(ck(startR, startC + i));
      }
    } else if (direction === "vertical") {
      startR = Math.floor(Math.random() * (ROWS - target.length));
      startC = Math.floor(Math.random() * COLS);
      for (let i = 0; i < target.length; i++) {
        temp[startR + i][startC] = target[i];
        posSet.add(ck(startR + i, startC));
      }
    } else if (direction === "diagonal") {
      startR = Math.floor(Math.random() * (ROWS - target.length));
      startC = Math.floor(Math.random() * (COLS - target.length));
      for (let i = 0; i < target.length; i++) {
        temp[startR + i][startC + i] = target[i];
        posSet.add(ck(startR + i, startC + i));
      }
    } else {
      // fallback: horizontal
      startR = Math.floor(Math.random() * ROWS);
      startC = Math.floor(Math.random() * (COLS - target.length));
      for (let i = 0; i < target.length; i++) {
        temp[startR][startC + i] = target[i];
        posSet.add(ck(startR, startC + i));
      }
    }
    // Fill the rest with random letters
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) if (!temp[r][c]) temp[r][c] = randLetter();
    setMatrix(temp);
    setPlacement(posSet);
    setFound(new Set());
  };
  // Update loadWord to use WORDS from state
  const loadWord = (idx, placementType = "Any") => {
    console.log("[LOG] loadWord called", {
      idx,
      WORDS,
      word: WORDS[idx],
      placementType,
    });
    if (idx >= WORDS.length) {
      if (!gameOver) setGameOver(true);
      return;
    }
    setWordIdx(idx);
    buildGrid(WORDS[idx], placementType);
    setTimeLeft(timer);
  };
  // Track last used placement type for nextWord
  const [lastPlacementType, setLastPlacementType] = useState("Any");
  /* —— Timer —— */
  useEffect(() => {
    clearInterval(timerRef.current);
    if (gameOver) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 0) {
          clearInterval(timerRef.current);
          // Instead of advancing locally, emit playerMissed to server
          const you = players.find((p) => p.you);
          if (you) {
            socket.emit("playerMissed", { code: roomCode, name: you.name });
          }
          return timer;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [wordIdx, timer, gameOver, players, roomCode]);
  /* —— Handle cell click —— */
  // Update onClick to emit playerScored event to server
  const onClick = (pos) => {
    if (gameOver) return;
    if (placement.has(pos) && !found.has(pos)) {
      const nf = new Set(found);
      nf.add(pos);
      setFound(nf);
      if (nf.size === placement.size) {
        // Only emit, do not update local score
        const you = players.find((p) => p.you);
        if (you) {
          socket.emit("playerScored", {
            code: roomCode,
            name: you.name,
            score: (typeof you.score === "number" ? you.score : 0) + 1,
          });
        }
        // Do not call nextWord();
      }
    } else {
      setFlash(pos);
      setTimeout(() => setFlash(null), 300);
    }
  };
  const isCorrect = (pos) => found.has(pos);
  /* —— Listen for gameStarted event from server —— */
  useEffect(() => {
    // Helper to normalize placement array to Set of 'row-col' strings
    function normalizePlacement(placementArr) {
      if (!Array.isArray(placementArr)) return new Set();
      // If already in 'row-col' string format
      if (typeof placementArr[0] === "string") return new Set(placementArr);
      // If array of [row, col] pairs
      if (Array.isArray(placementArr[0]) && placementArr[0].length === 2) {
        return new Set(placementArr.map(([r, c]) => `${r}-${c}`));
      }
      // If array of objects with r/c or row/col
      if (typeof placementArr[0] === "object") {
        return new Set(
          placementArr.map((pos) => {
            if ("r" in pos && "c" in pos) return `${pos.r}-${pos.c}`;
            if ("row" in pos && "col" in pos) return `${pos.row}-${pos.col}`;
            return String(pos);
          })
        );
      }
      return new Set();
    }
    // Helper to build grid from a given placement set and word
    function buildGridFromPlacement(word, placementSet) {
      // Fallback: if placementSet is not valid, use local buildGrid
      if (!placementSet || placementSet.size !== word.length) {
        buildGrid(word);
        return;
      }
      const temp = Array.from({ length: ROWS }, () => Array(COLS).fill(""));
      let i = 0;
      for (const pos of placementSet) {
        if (!pos) continue;
        const [r, c] = pos.split("-").map(Number);
        if (isNaN(r) || isNaN(c)) continue;
        temp[r][c] = word[i++] || randLetter();
      }
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (!temp[r][c]) temp[r][c] = randLetter();
      setMatrix(temp);
      setPlacement(placementSet);
      setFound(new Set());
    }
    function onGameStarted(payload) {
      console.log(
        "[DEBUG] [onGameStarted] event received",
        payload,
        "roomCode:",
        roomCode
      );
      if (payload && payload.settings) {
        console.log(
          "[DEBUG] Received placement from server:",
          payload.settings.placement,
          "placementType:",
          payload.settings.placementType
        );
      }
      const { code: gameCode, settings, players, words } = payload;
      if (!gameCode || !roomCode) {
        console.warn("[onGameStarted] Missing gameCode or roomCode", {
          gameCode,
          roomCode,
        });
        return;
      }
      if (gameCode !== roomCode) {
        console.warn("[onGameStarted] Room code mismatch", {
          gameCode,
          roomCode,
        });
        return;
      }
      console.log("[onGameStarted] Setting WORDS:", words);
      setRounds(settings.rounds);
      setTimer(settings.timer);
      setTimeLeft(settings.timer);
      setLastPlacementType(
        settings.placementType || settings.placement || "Any"
      );
      setWORDS(words || []); // Set the received word list
      setPlayers(
        (players || []).map((p, idx) => {
          const name = typeof p === "string" ? p : p.name;
          return { id: idx + 1, name, score: 0, you: name === playerName };
        })
      );
      setWordIdx(0);
    }
    socket.on("gameStarted", onGameStarted);
    return () => socket.off("gameStarted", onGameStarted);
  }, [roomCode, playerName]);
  /* —— Ensure socket joins the room on mount —— */
  useEffect(() => {
    // Ensure socket joins the room on mount
    if (roomCode && playerName) {
      socket.emit("joinRoom", { code: roomCode, username: playerName });
      console.log("[CLIENT] Emitted joinRoom from game page", {
        code: roomCode,
        username: playerName,
      });
    }
  }, [roomCode, playerName]);
  /* —— Listen for scoreUpdate event from server —— */
  useEffect(() => {
    function onScoreUpdate({ code, players: updatedPlayers }) {
      if (code !== roomCode) return;
      setPlayers((prev) => {
        // Preserve 'you' property by matching names (case-insensitive)
        return updatedPlayers
          .map((p, idx) => {
            const prevPlayer = prev.find(
              (pp) => pp.name.toLowerCase() === p.name.toLowerCase()
            );
            return {
              id: idx + 1,
              name: p.name,
              score: p.score,
              you: p.name.toLowerCase() === playerName.toLowerCase(),
            };
          })
          .sort((a, b) => b.score - a.score);
      });
    }
    socket.on("scoreUpdate", onScoreUpdate);
    return () => socket.off("scoreUpdate", onScoreUpdate);
  }, [roomCode, playerName]);
  /* —— Listen for nextRound and gameOver events from server —— */
  useEffect(() => {
    function onNextRound({ code }) {
      if (code !== roomCode) return;
      loadWord(wordIdx + 1, lastPlacementType);
    }
    function onGameOver({ code }) {
      if (code !== roomCode) return;
      setGameOver(true);
    }
    socket.on("nextRound", onNextRound);
    socket.on("gameOver", onGameOver);
    return () => {
      socket.off("nextRound", onNextRound);
      socket.off("gameOver", onGameOver);
    };
  }, [roomCode, wordIdx, lastPlacementType]);
  /* —— Global socket event logger for debugging —— */
  useEffect(() => {
    // Global socket event logger
    const logAll = (event, ...args) => {
      console.log("[SOCKET EVENT]", event, args);
    };
    socket.onAny(logAll);
    return () => socket.offAny(logAll);
  }, []);
  // Emit deleteRoom event to server when game is over
  useEffect(() => {
    if (gameOver && roomCode) {
      socket.emit("deleteRoom", { code: roomCode });
    }
  }, [gameOver, roomCode]);
  // After WORDS are set, load the first word
  useEffect(() => {
    console.log("[LOG] useEffect [WORDS] fired", {
      WORDS,
      length: WORDS.length,
    });
    if (WORDS.length > 0) {
      console.log("[LOG] Setting wordIdx=0, building grid for", WORDS[0]);
      setWordIdx(0);
      buildGrid(WORDS[0], lastPlacementType);
      setTimeLeft(timer);
    } else {
      console.log("[LOG] useEffect: Not ready. WORDS:", WORDS);
    }
    // eslint-disable-next-line
  }, [WORDS]);
  // Rules modal state
  const [showRules, setShowRules] = useState(false);
  const [countdown, setCountdown] = useState(7); // Increased from 3 to 7
  const countdownRef = useRef();
  // Show rules modal after gameStarted, then countdown
  useEffect(() => {
    if (WORDS.length > 0 && wordIdx === 0) {
      setShowRules(true);
      setCountdown(7); // Increased from 3 to 7
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) {
            clearInterval(countdownRef.current);
            setShowRules(false);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [WORDS]);
  // Tailwind helpers (move above render)
  const root = [
    "min-h-screen flex flex-col font-display text-gray-200",
    theme === "light"
      ? "from-[#f1f5f9] via-[#e7edf4] to-[#d9e4f2]"
      : "from-[#0f172a] via-[#111827] to-[#1e293b]",
    "bg-gradient-to-br",
  ].join(" ");
  const cellBase =
    "w-10 h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 flex items-center justify-center rounded font-semibold transition-colors select-none";
  // Results card component
  function ResultsCard({ players, onHome, onLobby }) {
    const winner = players[0];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
        <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] rounded-3xl shadow-2xl p-8 max-w-md w-full text-center border-2 border-primary animate-fade-in">
          <h2 className="text-3xl md:text-4xl font-extrabold text-secondary mb-2">
            🎉 Game Over!
          </h2>
          <p className="text-lg md:text-xl font-semibold mb-4 text-primary">
            {winner ? `🏆 Winner: ${winner.name}` : "No winner"}
          </p>
          <div className="mb-6">
            <h3 className="text-xl font-bold text-secondary mb-2">
              Final Scores
            </h3>
            <ul className="space-y-2">
              {players.map((p, i) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between px-4 py-2 rounded-lg ${
                    i === 0 ? "bg-primary/20 font-bold" : "bg-[#1e293b]/80"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-primary flex items-center justify-center font-bold text-black uppercase">
                      {p.name.charAt(0)}
                    </span>
                    <span>
                      {p.name}
                      {p.you && " (You)"}
                    </span>
                  </span>
                  <span className="text-lg font-extrabold text-secondary">
                    {p.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-4 justify-center mt-4">
            <button
              onClick={onHome}
              className="px-5 py-2 rounded-lg bg-primary text-black font-bold shadow hover:bg-primary/90 transition"
            >
              Home
            </button>
            <button
              onClick={onLobby}
              className="px-5 py-2 rounded-lg bg-secondary text-black font-bold shadow hover:bg-secondary/90 transition"
            >
              Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }
  // RulesModal component
  function RulesModal({ countdown }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-fade-in">
        <div className="relative bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#334155] border-4 border-primary rounded-3xl shadow-2xl p-8 max-w-lg w-full text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold text-secondary mb-4 drop-shadow">
            Game Rules
          </h2>
          <ul className="text-lg md:text-xl text-primary font-semibold mb-6 space-y-3 text-left mx-auto max-w-md">
            <li>
              •{" "}
              <span className="text-secondary font-bold">
                Who selects first
              </span>{" "}
              wins the round and moves to the next word.
            </li>
            <li>
              • <span className="text-primary">Be quick and accurate!</span> Try
              to be the first to find the word.
            </li>
            <li>
              •{" "}
              <span className="text-emerald-400 font-bold">
                Correct letters
              </span>{" "}
              stay <span className="text-emerald-400">green</span>.
            </li>
            <li>
              • <span className="text-red-400 font-bold">Wrong letters</span>{" "}
              flash <span className="text-red-400">red</span>.
            </li>
            <li>
              • <span className="text-secondary">Live scorecard</span> is
              visible at the right side of the grid.
            </li>
          </ul>
          <div className="flex flex-col items-center gap-2 mt-4">
            <span className="text-lg text-gray-300 font-mono mb-2 animate-pulse">
              Get ready…
            </span>
            <div className="flex items-center justify-center">
              <span className="text-5xl md:text-6xl font-extrabold text-primary">
                {countdown > 0 ? (
                  countdown
                ) : (
                  <span className="text-secondary animate-bounce">Go!</span>
                )}
              </span>
            </div>
            <div className="mt-4 animate-fade-in">
              <svg
                className="mx-auto w-16 h-16 text-primary animate-spin-slow"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <circle cx="12" cy="12" r="10" strokeOpacity=".3" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
          </div>
        </div>
        <style>{`
     @keyframes pop-in { 0% { transform: scale(0.7); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
     .animate-pop-in { animation: pop-in 0.5s cubic-bezier(.68,-0.55,.27,1.55) both; }
     .animate-spin-slow { animation: spin 2s linear infinite; }
    `}</style>
      </div>
    );
  }
  // Add navigation handlers using react-router-dom navigate
  const goHome = () => {
    navigate("/");
  };
  const goLobby = () => {
    navigate("/multiplayer");
  };
  // Disable Ctrl+F (and Cmd+F for Mac) on this page
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  /* —— Render —— */
  if (WORDS.length === 0) {
    console.log("[LOG] Render: Not gameReady");
    return (
      <div className="min-h-screen flex items-center justify-center text-xl text-primary">
        Loading game settings…
      </div>
    );
  }
  if (gameOver) {
    console.log("[LOG] Render: Game Over");
    // Sort players by score descending
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    return (
      <ResultsCard players={sortedPlayers} onHome={goHome} onLobby={goLobby} />
    );
  }
  console.log("[LOG] Render: Showing word", WORDS[wordIdx], "matrix:", matrix);
  // Show rules modal if needed
  return (
    <div className={root}>
      {showRules && <RulesModal countdown={countdown} />}
      {/* Nav */}
      <header className="sticky top-0 z-30 w-full bg-[#0f172a]/90 backdrop-blur ring-1 ring-white/5">
        <div className="max-w-7xl mx-auto grid grid-cols-[repeat(4,1fr)_auto] items-center gap-4 px-6 py-2 text-sm md:text-base">
          <span>
            Player: <span className="font-bold text-primary">{playerName}</span>
          </span>
          <span className="text-center">
            Score:{" "}
            <span className="font-semibold text-secondary">
              {players.find((p) => p.you).score}
            </span>
          </span>
          <span className="text-center">
            Time:{" "}
            <span className="font-semibold text-primary">{timeLeft}s</span>
          </span>
          <span className="text-center font-semibold text-primary">
            Rounds: {wordIdx + 1}/{rounds}
          </span>
          {/* Removed Placement, Same Seq, and Dupes labels/values as per requirements */}
          {/* Theme toggle */}
          <button
            className="justify-self-end w-10 h-10 flex items-center justify-center rounded-full bg-[#1e293b] hover:bg-[#334155] shadow-lg transition"
            onClick={toggleTheme}
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
      {/* Game area: two-column flex layout */}
      <main className="flex-1 overflow-hidden">
        {/* Heading + Scoreboard row (with improved spacing and alignment) */}
        <div className="max-w-7xl mx-auto flex flex-row items-start gap-6 px-4 md:px-6 mt-6">
          {/* Left column: Heading + Grid */}
          <div className="flex-1 min-w-0 flex flex-col items-center">
            <h2 className="find-word-title text-center text-3xl md:text-4xl font-semibold tracking-wide select-none mb-6">
              <span className="text-secondary mr-2">Find the Word:</span>
              <span className="text-primary font-extrabold tracking-widest">
                {WORDS[wordIdx]?.toUpperCase()}
              </span>
            </h2>
            <div className="flex justify-center w-full">
              <div
                className="grid gap-[4px]"
                style={{ gridTemplateColumns: `repeat(${COLS},minmax(0,1fr))` }}
              >
                {matrix.map((row, r) =>
                  row.map((ch, c) => {
                    const pos = ck(r, c);
                    const good = isCorrect(pos);
                    const bad = flash === pos;
                    return (
                      <button
                        key={pos}
                        onClick={() => onClick(pos)}
                        className={`${cellBase} ${
                          good
                            ? "bg-emerald-500 text-black shadow-neon"
                            : bad
                            ? "bg-red-500 animate-pulse text-white"
                            : "bg-[#1e293b] hover:bg-[#334155]"
                        }`}
                      >
                        {ch.toUpperCase()}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          {/* Right column: Scoreboard */}
          <aside className="hidden lg:flex flex-col scoreboard-container max-w-[300px] ml-8">
            <h2 className="scoreboard-title text-3xl md:text-4xl font-semibold tracking-wide select-none mb-6 text-center text-secondary">
              Scoreboard
            </h2>
            <div className="flex flex-col gap-4">
              {players.map((p, idx) => (
                <div
                  key={p.id}
                  className={`transition-all duration-300 flex items-center gap-3 px-4 py-3 rounded-xl ring-1 ring-white/10 ${
                    p.you ? "bg-primary/20" : "bg-[#111827]/80"
                  }`}
                  style={{ order: idx }}
                >
                  <span className="w-8 h-8 rounded-full bg-primary flex items-center justify-center font-bold text-black uppercase">
                    {p.name.charAt(0)}
                  </span>
                  <span className="flex-1 truncate font-semibold">
                    {p.name}
                    {p.you && " (You)"}
                  </span>
                  <span className="font-extrabold text-secondary text-lg leading-none">
                    {p.score}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </main>
      <footer className="py-2 text-center text-xs text-gray-400 select-none">
        Wrong picks flash red · Round ends after {timer} seconds or when all
        letters found.
      </footer>
    </div>
  );
}
