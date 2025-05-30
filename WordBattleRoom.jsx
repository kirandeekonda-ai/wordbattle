import React, { useState, useLayoutEffect, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import socket from "./src/socket.ts";
/**
 * WordBattle– Room Lobby (React)
 * TailwindCSS Midnight‑Neon palette assumed globally (same as landing).
 * URL query params: ?room=CODE&host=1&max=8
 */
//Utility helpers
const useQuery = () =>
  Object.fromEntries(new URLSearchParams(window.location.search));
const applyTheme = (mode) => {
  const body = document.body;
  const dark = [
    "bg-gradient-to-br",
    "from-[#0f172a]",
    "via-[#111827]",
    "to-[#1e293b]",
  ];
  const light = [
    "bg-gradient-to-br",
    "from-[#f1f5f9]",
    "via-[#e7edf4]",
    "to-[#d9e4f2]",
  ];
  body.classList.remove(...dark, ...light);
  body.classList.add(...(mode === "light" ? light : dark));
  localStorage.setItem("theme", mode);
};
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
export default function WordbattleRoom() {
  /* ───Query params─── */
  const {
    room: roomCode = "SPACE123",
    host: hostFlag = "0",
    max: maxParam = "8",
  } = useQuery();
  const code = roomCode;
  const [maxPlayers, setMaxPlayers] = useState(Number(maxParam));
  /* ───Theme ─── */
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "neon"
  );
  useLayoutEffect(() => applyTheme(theme), [theme]);
  /* ───Roster state─── */
  const [players, setPlayers] = useState([
    { name: "HostName", ping: 24, isHost: true, avatar: "A" },
  ]);
  /* ───Chat state─── */
  const [messages, setMessages] = useState([]);
  const chatEndRef = useRef(null);
  const scrollToEnd = () =>
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(scrollToEnd, [messages]);
  /* ───Settings─── */
  const [rounds, setRounds] = useState(5);
  const [timer, setTimer] = useState(30);
  // Placement state: allow multiple, default to ['horizontal']
  const [placement, setPlacement] = useState(["horizontal"]);
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem("wbUsername") || "Player";
  // Emit joinRoom if not host (i.e., joining an existing room)
  useEffect(() => {
    if (code && username) {
      socket.emit("joinRoom", { code, username });
    }
  }, [code, username]);
  // Cleanup: leave room on unmount
  useEffect(() => {
    return () => {
      if (code && username) {
        socket.emit("leaveRoom", { code, username });
      }
    };
  }, [code, username]);
  // Update favicon and title with player name
  useEffect(() => {
    setFaviconWithPlayer(username);
  }, [username]);
  // Listen for player list updates from server
  useEffect(() => {
    function onRoomPlayers(data) {
      // If this event is for our room, update maxPlayers if provided
      if (data.code && data.code === code && typeof data.max === "number") {
        setMaxPlayers(data.max);
      }
      // If server returns empty, add self as host
      if (!data.players || data.players.length === 0) {
        setPlayers([
          {
            name: username,
            isHost: true,
            avatar: username[0]?.toUpperCase() || "?",
          },
        ]);
        return;
      }
      setPlayers(
        data.players.map((player, idx) => ({
          name: player.name,
          isHost: idx === 0,
          avatar: player.name[0]?.toUpperCase() || "?",
        }))
      );
    }
    socket.on("roomPlayers", onRoomPlayers);
    // Request initial player list
    socket.emit("getRoomPlayers", { code });
    return () => socket.off("roomPlayers", onRoomPlayers);
  }, [code, username]);
  // Ensure maxPlayers is updated if server sends a new max
  useEffect(() => {
    function onRoomPlayers(data) {
      if (data.code && data.code === code && typeof data.max === "number") {
        setMaxPlayers(data.max);
      }
    }
    socket.on("roomPlayers", onRoomPlayers);
    return () => socket.off("roomPlayers", onRoomPlayers);
  }, [code]);
  // After mount, if isHost and players is empty, request player list
  useEffect(() => {
    if (players.length === 0 && code) {
      socket.emit("getRoomPlayers", { code });
    }
  }, [players.length, code]);
  // Listen for chat messages from server
  useEffect(() => {
    function onRoomChat({ code: msgRoom, username: from, text }) {
      if (msgRoom !== code) return; // Only for this room
      setMessages((m) => [...m, { me: from === username, text, from }]);
    }
    socket.on("roomChat", onRoomChat);
    return () => socket.off("roomChat", onRoomChat);
  }, [code, username]);
  // Ref to track if the next settings update is from the socket (remote)
  const isRemoteUpdate = useRef(false);
  // Listen for settings updates from server and update local state (non-hosts only)
  useEffect(() => {
    function onSettingsUpdate({ code: updateCode, settings }) {
      if (updateCode !== code || !settings) return;
      if (isHost) return; // Host ignores updates from server to prevent loop
      isRemoteUpdate.current = true;
      setRounds(settings.rounds);
      setTimer(settings.timer);
      setPlacement(settings.placement);
    }
    socket.on("roomSettingsUpdate", onSettingsUpdate);
    return () => socket.off("roomSettingsUpdate", onSettingsUpdate);
  }, [code, isHost]);
  // Helper: emit settings update if host, but only for local changes
  useEffect(() => {
    if (!isHost) return;
    if (isRemoteUpdate.current) {
      isRemoteUpdate.current = false;
      return;
    }
    const settings = { rounds, timer, placement };
    socket.emit("roomSettingsUpdate", { code, settings });
  }, [rounds, timer, placement, isHost, code]);
  /* ───Event handlers─── */
  const copyRoom = () => {
    navigator.clipboard.writeText(roomCode);
    toast("Room code copied");
  };
  const toast = (msg) => {
    setToasts((t) => [...t, { id: Date.now(), msg }]);
  };
  const [toasts, setToasts] = useState([]);
  useEffect(() => {
    if (toasts.length === 0) return;
    const id = setTimeout(() => setToasts((t) => t.slice(1)), 2500);
    return () => clearTimeout(id);
  }, [toasts]);
  const sendChat = (e) => {
    e.preventDefault();
    const form = e.target;
    const input = form.elements.msg;
    const txt = input.value.trim();
    if (!txt) return;
    // Emit to server only, do not optimistically add to chat (to avoid double message)
    socket.emit("roomChat", { code, username, text: txt });
    input.value = "";
    toast("You sent a message");
  };
  // Start Game handler
  function startGame() {
    // Only host can start and only if more than 1 player
    if (isHost && players.length > 1) {
      // Gather all settings and player names
      const gameSettings = {
        code,
        settings: {
          rounds,
          timer,
          placement,
        },
        players: players.map((p) => p.name),
      };
      socket.emit("startGame", gameSettings);
    }
  }
  const isHost = players.length > 0 && players[0].name === username;
  // Placement change handler
  function handlePlacementChange(option) {
    if (option === "any") {
      setPlacement(["any"]);
    } else {
      if (placement.includes("any")) {
        setPlacement([option]);
      } else {
        let updated = placement.includes(option)
          ? placement.filter((p) => p !== option)
          : [...placement, option];
        const allDirs = ["horizontal", "vertical", "diagonal"];
        // If all three are checked, treat as 'any'
        if (allDirs.every((d) => updated.includes(d))) {
          updated = ["any"];
        }
        // If none are checked, default to 'any'
        if (updated.length === 0) {
          updated = ["any"];
        }
        setPlacement(updated);
      }
    }
  }
  // Tooltip state for settings info icons
  const [visibleTooltip, setVisibleTooltip] = useState(null);
  const tooltipTimeout = useRef();
  // Helper to show/hide tooltips with fade
  function handleTooltip(icon) {
    clearTimeout(tooltipTimeout.current);
    setVisibleTooltip(icon);
  }
  function handleTooltipHide() {
    // Fade out, then hide
    tooltipTimeout.current = setTimeout(() => setVisibleTooltip(null), 120);
  }
  // Listen for gameStarted event and navigate to game page
  useEffect(() => {
    function onGameStarted({ code: gameCode }) {
      if (gameCode === code) {
        navigate(`/multiplayer/game?room=${code}`);
      }
    }
    socket.on("gameStarted", onGameStarted);
    return () => socket.off("gameStarted", onGameStarted);
  }, [code, navigate]);
  /* ───Render─── */
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
      {/* Nav bar */}
      <header className="sticky top-0 z-30 bg-[#0f172a]/90 ring-1 ring-white/5 backdrop-blur">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 md:px-6 py-3 text-sm md:text-base">
          <div className="flex items-center gap-2 select-none">
            <span className="text-gray-400 font-semibold mr-1">Room Code:</span>
            <span className="font-semibold tracking-widest text-primary">
              {roomCode}
            </span>
            <button
              onClick={copyRoom}
              title="Copy code"
              className="p-1 rounded hover:bg-[#1e293b] transition"
            >
              <svg
                className="w-5 h-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-4 4h4a2 2 0 012 2v6a2 2 0 01-2 2h-8a2 2 0 01-2-2v-4"
                />
              </svg>
            </button>
          </div>
          <button
            onClick={() => navigate("/multiplayer")}
            className="px-4 py-2 border border-secondary text-secondary rounded hover:bg-secondary/20 transition"
          >
            LeaveRoom
          </button>
        </div>
      </header>
      {/* Main layout */}
      <main className="flex-1 overflow-hidden">
        <div
          className="max-w-7xl mx-auto h-full px-4 md:px-6 grid lg:grid-cols-[20rem_minmax(0,1fr)_16rem] gap-6 pt-6"
          style={{ height: "calc(100vh - 120px)" }}
        >
          {/* Roster */}
          <section
            className="bg-[#111827]/80 ring-1 ring-white/10 rounded-xl p-4 flex flex-col min-h-0"
            style={{ height: "100%" }}
          >
            <h2 className="text-center font-bold mb-3">
              Players ({players.length}/{maxPlayers})
            </h2>
            <ul
              className="space-y-2 overflow-y-auto"
              style={{ maxHeight: "calc(100% - 48px)", minHeight: 0 }}
            >
              {players.map((p, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 p-2 rounded bg-[#1e2538]"
                >
                  <span
                    className="flex items-center justify-center font-bold text-black uppercase bg-primary rounded-full"
                    style={{
                      width: "2.5rem",
                      height: "2.5rem",
                      minWidth: "2.5rem",
                      minHeight: "2.5rem",
                      position: "relative",
                    }}
                  >
                    {p.avatar}
                    {p.isHost && (
                      <span
                        className="absolute -bottom-1 -right-1 w-5 h-5 flex items-center justify-center bg-transparent"
                        title="Host"
                        style={{ boxShadow: "0 0 6px 2px #facc15" }}
                      >
                        <svg
                          className="w-4 h-4 text-yellow-400 drop-shadow"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M10 15l-5.878 3.09 1.122-6.545L.488 6.91l6.561-.955L10 0l2.951 5.955 6.561.955-4.756 4.635 1.122 6.545z" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <input
                    value={p.name}
                    readOnly={true}
                    className="flex-1 bg-transparent border-none outline-none font-semibold"
                  />
                </li>
              ))}
            </ul>
          </section>
          {/* Chat */}
          <section
            className="flex flex-col h-full bg-[#111827]/80 ring-1 ring-white/10 rounded-xl min-w-0 min-h-0"
            style={{ height: "100%" }}
          >
            <div
              id="chatLog"
              className="flex-1 overflow-y-auto p-4 space-y-3 text-sm custom-scrollbar"
              style={{ minHeight: 0, maxHeight: "100%" }}
            >
              {messages.map((m, i) => {
                const initials = m.from
                  ? m.from
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()
                  : "";
                return (
                  <div
                    key={i}
                    className={`flex ${m.me ? "justify-end" : "justify-start"}`}
                  >
                    {!m.me && (
                      <span className="flex-shrink-0 w-7 h-7 mr-2 rounded-full bg-primary text-black font-bold flex items-center justify-center text-xs">
                        {initials}
                      </span>
                    )}
                    <div
                      className={`${
                        m.me ? "bg-primary/20" : "bg-[#1e2538]"
                      } px-3 py-2 rounded-lg max-w-[70%] whitespace-pre-wrap shadow-sm break-words overflow-wrap break-word`}
                      style={{
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                        whiteSpace: "pre-wrap",
                        maxWidth: "70%",
                      }}
                    >
                      <span className="block text-xs text-gray-400 font-semibold mb-1">
                        {m.me ? "You" : m.from || ""}
                      </span>
                      {m.text}
                    </div>
                    {m.me && (
                      <span className="flex-shrink-0 w-7 h-7 ml-2 rounded-full bg-primary text-black font-bold flex items-center justify-center text-xs">
                        {initials || "Y"}
                      </span>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            <form
              onSubmit={sendChat}
              className="flex p-3 gap-2 border-t border-white/10"
            >
              <input
                name="msg"
                placeholder="Type…"
                className="flex-1 bg-[#0f172a] rounded px-3 py-2 text-sm focus:outline-none"
              />
              <button className="px-4 py-2 bg-primary text-black font-bold rounded shadow-neon">
                Send
              </button>
            </form>
          </section>
          {/* Settings */}
          <section
            className="bg-[#111827]/80 ring-1 ring-white/10 rounded-xl p-4 flex flex-col gap-4 min-h-0 min-w-[320px] max-w-[420px] w-full mx-auto"
            style={{ height: "100%" }}
          >
            <h2 className="text-center font-bold">GameSettings</h2>
            <label className="text-sm flex flex-col gap-1">
              Rounds
              <select
                value={rounds}
                onChange={(e) => setRounds(Number(e.target.value))}
                disabled={!isHost}
                className="bg-[#0f172a] border border-primary text-primary font-semibold rounded px-3 py-2 shadow-neon focus:ring-2 focus:ring-secondary focus:border-secondary transition duration-150 outline-none hover:bg-[#1e293b] hover:border-secondary disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  boxShadow:
                    theme === "light"
                      ? "0 0 0 2px #38bdf8"
                      : "0 0 10px #38bdf8",
                }}
              >
                {[3, 5, 10].map((v) => (
                  <option key={v} className="bg-[#0f172a] text-primary">
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm flex flex-col gap-1">
              Per‑word Timer (s)
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={90}
                  step={1}
                  value={timer}
                  onChange={(e) => setTimer(Number(e.target.value))}
                  disabled={!isHost}
                  className="w-full h-3 rounded-full bg-[#1e293b] appearance-none focus:outline-none focus:ring-2 focus:ring-primary transition timer-slider"
                  style={{
                    accentColor: theme === "light" ? "#38bdf8" : "#fb7185",
                  }}
                />
                <span
                  className="ml-2 w-14 text-right font-mono text-primary text-base drop-shadow"
                  style={{ textShadow: "0 0 6px #38bdf8" }}
                >
                  ⏱ {timer}s
                </span>
              </div>
              <style>{`
        .timer-slider::-webkit-slider-thumb {
         height: 1.1rem;
         width: 1.1rem;
         margin-top: -0.3rem;
         border-radius: 50%;
         background: radial-gradient(circle at 60% 40%, #38bdf8 70%, #fb7185 100%);
         box-shadow: 0 0 12px 2px #38bdf8, 0 0 0 2px #fff;
         border: 2px solid #fff;
         cursor: pointer;
         transition: background 0.2s, box-shadow 0.2s;
        }
        .timer-slider:focus::-webkit-slider-thumb {
         background: radial-gradient(circle at 40% 60%, #fb7185 70%, #38bdf8 100%);
         box-shadow: 0 0 16px 4px #fb7185, 0 0 0 2px #fff;
        }
        .timer-slider::-moz-range-thumb {
         height: 1.1rem;
         width: 1.1rem;
         border-radius: 50%;
         background: radial-gradient(circle at 60% 40%, #38bdf8 70%, #fb7185 100%);
         box-shadow: 0 0 12px 2px #38bdf8, 0 0 0 2px #fff;
         border: 2px solid #fff;
         cursor: pointer;
         transition: background 0.2s, box-shadow 0.2s;
        }
        .timer-slider:focus::-moz-range-thumb {
         background: radial-gradient(circle at 40% 60%, #fb7185 70%, #38bdf8 100%);
         box-shadow: 0 0 16px 4px #fb7185, 0 0 0 2px #fff;
        }
        .timer-slider::-ms-thumb {
         height: 1.1rem;
         width: 1.1rem;
         border-radius: 50%;
         background: radial-gradient(circle at 60% 40%, #38bdf8 70%, #fb7185 100%);
         box-shadow: 0 0 12px 2px #38bdf8, 0 0 0 2px #fff;
         border: 2px solid #fff;
         cursor: pointer;
         transition: background 0.2s, box-shadow 0.2s;
        }
        .timer-slider:focus::-ms-thumb {
         background: radial-gradient(circle at 40% 60%, #fb7185 70%, #38bdf8 100%);
         box-shadow: 0 0 16px 4px #fb7185, 0 0 0 2px #fff;
        }
        .timer-slider::-webkit-slider-runnable-track {
         height: 0.55rem;
         border-radius: 9999px;
         background: linear-gradient(90deg, #38bdf8 0%, #fb7185 100%);
         box-shadow: 0 0 8px 2px #38bdf8;
        }
        .timer-slider::-moz-range-track {
         height: 0.55rem;
         border-radius: 9999px;
         background: linear-gradient(90deg, #38bdf8 0%, #fb7185 100%);
         box-shadow: 0 0 8px 2px #38bdf8;
        }
        .timer-slider::-ms-fill-lower, .timer-slider::-ms-fill-upper {
         height: 0.55rem;
         border-radius: 9999px;
         background: linear-gradient(90deg, #38bdf8 0%, #fb7185 100%);
         box-shadow: 0 0 8px 2px #38bdf8;
        }
        .timer-slider:focus {
         outline: none;
        }
        .timer-slider::-ms-tooltip { display: none; }
        input[type=range] { padding: 0; }
       `}</style>
            </label>
            <label className="text-sm flex flex-col gap-1">
              Word Placement
              <div className="flex flex-col gap-4 mt-1">
                {/* Word placement options as checkboxes */}
                {["horizontal", "vertical", "diagonal", "any"].map((key) => {
                  const label = key.charAt(0).toUpperCase() + key.slice(1);
                  const inputId = `placement-${key}`;
                  return (
                    <span
                      key={key}
                      className="relative group flex items-center"
                    >
                      <input
                        type="checkbox"
                        id={inputId}
                        name={inputId}
                        checked={placement.includes(key)}
                        onChange={() => handlePlacementChange(key)}
                        disabled={!isHost}
                        className="accent-primary mr-2 align-middle"
                      />
                      <label
                        htmlFor={inputId}
                        className="align-middle font-semibold text-primary cursor-pointer select-none mr-3"
                      >
                        {label}
                      </label>
                      <button
                        type="button"
                        tabIndex="0"
                        className="ml-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full bg-[#1e293b] p-1 flex items-center justify-center shadow-neon group-hover:shadow-primary/60 transition"
                        aria-label={`What is ${label}?`}
                        onMouseEnter={() => handleTooltip(key)}
                        onFocus={() => handleTooltip(key)}
                        onMouseLeave={handleTooltipHide}
                        onBlur={handleTooltipHide}
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="text-primary"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <circle
                            cx="10"
                            cy="10"
                            r="9"
                            stroke="#38bdf8"
                            strokeWidth="2"
                            fill="#1e293b"
                          />
                          <text
                            x="10"
                            y="15"
                            textAnchor="middle"
                            fontSize="11"
                            fill="#38bdf8"
                            fontFamily="Rajdhani, sans-serif"
                          >
                            ?
                          </text>
                        </svg>
                      </button>
                      <span
                        className={`pointer-events-none absolute left-1/2 top-full z-20 w-56 -translate-x-1/2 mt-2 px-3 py-2 rounded-xl bg-[#0f172a] text-xs text-primary font-semibold shadow-neon border border-primary/30 transition-opacity duration-200 ${
                          visibleTooltip === key ? "opacity-100" : "opacity-0"
                        }`}
                        style={{ whiteSpace: "normal" }}
                      >
                        <span className="block mb-1 text-base text-primary">
                          {label}
                        </span>
                        {key === "horizontal" &&
                          "Words are placed left-to-right only."}
                        {key === "vertical" &&
                          "Words are placed top-to-bottom only."}
                        {key === "diagonal" && "Words are placed diagonally."}
                        {key === "any" &&
                          "Words can be placed in any direction."}
                      </span>
                    </span>
                  );
                })}
              </div>
            </label>
            <button
              onClick={startGame}
              disabled={!(isHost && players.length > 1)}
              className={`mt-auto px-4 py-3 rounded font-bold shadow-neon transition ${
                isHost && players.length > 1
                  ? "bg-primary text-black hover:bg-primary/90"
                  : "bg-[#334155] cursor-not-allowed"
              }`}
            >
              {isHost
                ? players.length > 1
                  ? "Start Game"
                  : "Let's wait for players…"
                : "Waiting for Host…"}
            </button>
          </section>
        </div>
      </main>
      {/* Footer */}
      <footer className="py-2 text-center text-xs text-gray-400 select-none">
        When the host leaves, the next player automatically becomes the host.
      </footer>
      {/* Toasts */}
      <div className="fixed left-4 bottom-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="px-3 py-2 bg-secondary text-black rounded shadow-md animate-pulse"
          >
            {t.msg}
          </div>
        ))}
      </div>
      {/* Custom scrollbar styling (Tailwind can't do this inline) */}
      <style>{`
.custom-scrollbar::-webkit-scrollbar {
 width: 8px;
 background: #1e2538;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
 background: #334155;
 border-radius: 4px;
}
.transition-opacity { transition: opacity 0.22s cubic-bezier(.4,0,.2,1); }
select.bg-\[\#0f172a\]::-ms-expand { display: none; }
select.bg-\[\#0f172a\]::-webkit-input-placeholder { color: #38bdf8; }
select.bg-\[\#0f172a\]:focus { outline: none; border-color: #fb7185; box-shadow: 0 0 0 2px #fb7185; }
`}</style>
    </div>
  );
}
