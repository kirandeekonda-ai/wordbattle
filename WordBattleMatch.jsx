import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import socket from "./src/socket.ts";
/**
 * WordBattle– Multiplayer Lobby (React) ‑ v2
 * • Added "Back to Home" link (top‑left)
 * • Reworked Create‑Room card: user may enter a custom room name *or* click "Generate" for an auto code, and pick max players (2‑8).
 * TailwindCSS Midnight‑Neon palette must be configured globally.
 */
/* ───────────────────────── Helpers ───────────────────────── */
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const genCode = () =>
  Array.from(
    { length: 6 },
    () => CHARS[(Math.random() * CHARS.length) | 0]
  ).join("");
// Fake API for demo – replace with real fetch later.
const mockFetchRooms = () =>
  Promise.resolve([
    { code: "SPACE1", players: 4, max: 8 },
    { code: "NINJA9", players: 2, max: 8 },
    { code: "FOX777", players: 8, max: 8 }, // full
  ]);
/* ────────────────────── Main Component ───────────────────── */
function setFaviconWithPlayer(playerName) {
  // Remove existing dynamic favicon if any
  const old = document.getElementById("dynamic-favicon");
  if (old) old.remove();
  // Create canvas for favicon
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  // Draw circle background
  ctx.fillStyle = "#38bdf8"; // primary color
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, 2 * Math.PI);
  ctx.fill();
  // Draw initials
  ctx.font = "bold 32px Rajdhani, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#fff";
  const initials = playerName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  ctx.fillText(initials, 32, 36);
  // Set favicon
  const link = document.createElement("link");
  link.id = "dynamic-favicon";
  link.rel = "icon";
  link.type = "image/png";
  link.href = canvas.toDataURL("image/png");
  document.head.appendChild(link);
  // Set document title with player name
  document.title = `Player Name: ${playerName}`;
}
export default function WordbattleMatch() {
  /* Room list state */
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  /* Theme state */
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "neon"
  );
  /* Create‑room form state */
  const [roomInput, setRoomInput] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const navigate = useNavigate();
  /* Apply theme classes to <body> */
  const applyTheme = useCallback((mode) => {
    const body = document.body;
    const darkBG = [
      "bg-gradient-to-br",
      "from-[#0f172a]",
      "via-[#111827]",
      "to-[#1e293b]",
    ];
    const lightBG = [
      "bg-gradient-to-br",
      "from-[#f1f5f9]",
      "via-[#e7edf4]",
      "to-[#d9e4f2]",
    ];
    body.classList.remove(...darkBG, ...lightBG);
    body.classList.add(...(mode === "light" ? lightBG : darkBG));
    localStorage.setItem("theme", mode);
  }, []);
  useEffect(() => applyTheme(theme), [theme, applyTheme]);
  /* Fetch rooms only once on mount, rely on socket for updates */
  useEffect(() => {
    setLoading(true);
    const onRooms = (data) => {
      setRooms(data);
      setLoading(false);
    };
    socket.on("rooms", onRooms);
    socket.emit("getRooms"); // Initial fetch
    return () => {
      socket.off("rooms", onRooms);
    };
  }, []);
  // Get username from localStorage for use in multiplayer lobby/room
  useEffect(() => {
    const username = localStorage.getItem("wbUsername");
    if (username) {
      // Optionally, you can use this username for display or pass to room creation
      // For now, just log or set as needed
      // Example: setPlayerName(username);
    }
  }, []);
  useEffect(() => {
    const playerName = localStorage.getItem("wbUsername") || "Player";
    setFaviconWithPlayer(playerName);
  }, []);
  // Listen for player list updates from server (for lobby room counts)
  useEffect(() => {
    function onRoomPlayers({
      code: changedCode,
      players: playerList,
      max,
      locked,
    }) {
      setRooms((prevRooms) => {
        let found = false;
        const updated = prevRooms.map((r) => {
          if (r.code === changedCode) {
            found = true;
            return {
              ...r,
              players: playerList.length,
              max: max || r.max,
              locked: typeof locked === "boolean" ? locked : r.locked,
            };
          }
          return r;
        });
        // If the room is not in the list (e.g., was empty and now created), add it
        if (!found && playerList.length > 0) {
          updated.push({
            code: changedCode,
            players: playerList.length,
            max: max || 8,
            locked: !!locked,
          });
        }
        return updated;
      });
    }
    socket.on("roomPlayers", onRoomPlayers);
    return () => socket.off("roomPlayers", onRoomPlayers);
  }, []);
  /* Navigation helper */
  const gotoRoom = (code, isHost) => {
    navigate(`/room?room=${code}&host=${isHost ? 1 : 0}&max=${maxPlayers}`);
  };
  /* Create room handler */
  const handleCreate = () => {
    const code = roomInput.trim()
      ? roomInput
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "")
          .slice(0, 12)
      : genCode();
    const username = localStorage.getItem("wbUsername") || "Player";
    socket.emit("createRoom", { code, max: maxPlayers, username }, (res) => {
      if (res && res.error) {
        alert(res.error);
        return;
      }
      gotoRoom(code, true);
    });
  };
  /* Render */
  return (
    <div className="min-h-screen flex flex-col font-display text-gray-200">
      {/* Theme toggle */}
      <button
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === "neon" ? "light" : "neon")}
        className="fixed top-4 right-4 z-40 w-11 h-11 flex items-center justify-center rounded-full bg-[#1e293b] hover:bg-[#334155] shadow-lg transition"
      >
        <svg
          className={`w-6 h-6 text-primary ${
            theme === "light" ? "hidden" : ""
          }`}
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
        <svg
          className={`w-6 h-6 text-yellow-400 ${
            theme === "light" ? "" : "hidden"
          }`}
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
      </button>
      {/* Back to Home */}
      <a
        href="#"
        className="fixed top-4 left-4 z-40 text-secondary hover:text-primary underline font-semibold"
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        ← Home
      </a>
      {/* Header */}
      <header className="pt-20 pb-10 text-center">
        <h1 className="text-5xl font-bold text-primary drop-shadow-sm">
          Multiplayer Lobby
        </h1>
        <p className="mt-2 text-gray-400 text-lg">
          Create or join a room to battle words with friends.
        </p>
      </header>
      {/* Main layout */}
      <main className="flex-1 container mx-auto px-4 flex flex-col md:flex-row gap-8 items-start lobby-sections">
        {/* Create Room */}
        <section className="room-card flex-1 min-w-[320px] max-w-xl bg-[#111827]/90 rounded-2xl ring-1 ring-white/10 p-6 flex flex-col items-stretch shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-primary text-center">
            Create Room
          </h2>
          {/* Room name input */}
          <label className="text-sm text-gray-400 mb-1" htmlFor="roomName">
            Room&nbsp;Name&nbsp;(optional)
          </label>
          <input
            id="roomName"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="Auto‑generated if left blank"
            className="mb-4 px-4 py-2 rounded-md bg-[#1e293b] border border-[#334155] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {/* Max players select */}
          <label className="text-sm text-gray-400 mb-1" htmlFor="maxPlayers">
            Max&nbsp;Players
          </label>
          <select
            id="maxPlayers"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="mb-6 px-4 py-2 rounded-md bg-[#1e293b] border border-[#334155] focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {[...Array(7)].map((_, i) => {
              const v = i + 2; // 2‑8
              return (
                <option key={v} value={v}>
                  {v}
                </option>
              );
            })}
          </select>
          {/* Buttons */}
          <button
            onClick={handleCreate}
            className="mb-3 px-6 py-3 rounded-xl font-bold bg-primary/90 hover:bg-primary shadow-neon border border-primary/60 transition"
          >
            Create &amp; Enter
          </button>
          <button
            type="button"
            onClick={() => setRoomInput(genCode())}
            className="text-sm text-secondary hover:text-primary transition underline self-center"
          >
            Generate Random Code
          </button>
        </section>
        {/* Available Rooms */}
        <section className="room-card flex-1 min-w-[320px] max-w-xl bg-[#111827]/90 rounded-2xl ring-1 ring-white/10 p-6 flex flex-col items-stretch shadow-lg">
          <h2 className="text-2xl font-semibold mb-4 text-primary text-center">
            Available Rooms
          </h2>
          {loading ? (
            <p className="text-center text-gray-400 flex-1 flex items-center justify-center">
              Loading…
            </p>
          ) : rooms.length === 0 ? (
            <p className="text-center text-gray-400 flex-1 flex items-center justify-center">
              No open rooms.
            </p>
          ) : (
            <ul className="room-list flex-1 flex flex-col gap-3 overflow-y-auto max-h-[300px] pr-0">
              {rooms.map(({ code, players, max, locked }) => {
                const full = players >= max;
                const empty = players === 0;
                return (
                  <li
                    key={code}
                    className="flex items-center justify-between bg-[#1e293b] rounded-lg px-4 py-2 min-h-[3.2rem] shadow border border-[#334155]"
                    style={{ minWidth: 0 }}
                  >
                    <span
                      className="font-mono tracking-wider text-lg truncate max-w-[7.5rem]"
                      title={code}
                    >
                      {code}
                    </span>
                    <span className="text-gray-400 text-sm font-semibold mx-2 whitespace-nowrap">
                      {players} / {max}
                    </span>
                    {locked ? (
                      <span className="ml-3 flex items-center group relative justify-center min-w-[90px] w-[90px]">
                        <svg
                          className="w-6 h-6 text-primary drop-shadow"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          viewBox="0 0 24 24"
                        >
                          <rect
                            x="6"
                            y="10"
                            width="12"
                            height="8"
                            rx="2"
                            fill="#0f172a"
                            stroke="#38bdf8"
                          />
                          <path
                            d="M8 10V8a4 4 0 1 1 8 0v2"
                            stroke="#38bdf8"
                            strokeWidth="2.2"
                          />
                          <circle cx="12" cy="15" r="1.3" fill="#38bdf8" />
                        </svg>
                        <span className="absolute left-1/2 top-full z-20 w-48 -translate-x-1/2 mt-2 px-3 py-2 rounded-xl bg-[#0f172a] text-xs text-primary font-semibold shadow-neon border border-primary/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none select-none">
                          Game already started for this room
                        </span>
                      </span>
                    ) : (
                      <button
                        disabled={full}
                        onClick={() => gotoRoom(code, empty)}
                        className={`ml-3 px-4 py-1.5 rounded-md text-sm font-bold border transition whitespace-nowrap min-w-[90px] w-[90px] flex items-center justify-center ${
                          full
                            ? "opacity-40 cursor-not-allowed border-gray-600"
                            : empty
                            ? "border-green-400 text-green-400 hover:border-primary hover:text-primary"
                            : "border-secondary text-secondary hover:border-primary hover:text-primary"
                        }`}
                      >
                        {empty ? "Join as Host" : "Join"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
      {/* Custom styles for scrollbars and card consistency */}
      <style>{`
.lobby-sections { gap: 2rem; align-items: flex-start; justify-content: center; }
.room-card {
 background: #111827e6;
 border-radius: 1.25rem;
 padding: 1.5rem;
 box-shadow: 0 0 10px rgba(56,189,248,0.10), 0 2px 8px rgba(0,0,0,0.18);
 overflow: visible; /* Allow tooltips to escape */
}                                                                                                                                                                                                                           
.room-list {
 overflow-y: visible; /* Allow tooltips to escape */
 max-height: 300px;
 scrollbar-width: none;
 -ms-overflow-style: none;
}
.room-list::-webkit-scrollbar {
 display: none;
}
`}</style>
      {/* Footer */}
      <footer className="py-6 text-center text-xs text-gray-400">
        Nothing saved · profanity filter on · &lt;300 ms latency
      </footer>
    </div>
  );
}
