import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
const adjectives = [
  "Swift",
  "Clever",
  "Brave",
  "Witty",
  "Lucky",
  "Epic",
  "Bold",
  "Chill",
  "Calm",
  "Zany",
];
const nouns = [
  "Penguin",
  "Lion",
  "Wizard",
  "Hero",
  "Fox",
  "Ninja",
  "Knight",
  "Owl",
  "Scribe",
  "Sphinx",
];
function genUsername() {
  return (
    adjectives[(Math.random() * adjectives.length) | 0] +
    nouns[(Math.random() * nouns.length) | 0] +
    ((Math.random() * 1000) | 0)
  );
}
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
export default function LandingPage() {
  const [username, setUsername] = useState(genUsername());
  const [theme, setTheme] = useState(
    () => localStorage.getItem("theme") || "neon"
  );
  const canvasRef = useRef(null);
  const navigate = useNavigate();
  // Save username to localStorage before navigating
  const handleSinglePlayer = () => {
    localStorage.setItem("wbUsername", username);
    navigate("/game");
  };
  const handleMultiplayer = (e) => {
    e.preventDefault();
    localStorage.setItem("wbUsername", username);
    navigate("/multiplayer");
  };
  // Theme effect
  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.body.classList.remove(...darkBG, ...lightBG);
    document.body.classList.add(...(theme === "light" ? lightBG : darkBG));
    return () => {
      document.body.classList.remove(...darkBG, ...lightBG);
    };
  }, [theme]);
  // Dots grid effect
  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs.getContext("2d");
    let W = window.innerWidth,
      H = window.innerHeight,
      mouse = { x: -1e3, y: -1e3 };
    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      cvs.width = W;
      cvs.height = H;
    }
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    window.addEventListener("mouseleave", () => {
      mouse.x = -1e3;
      mouse.y = -1e3;
    });
    const spacing = 40,
      r = 2.2,
      blue = "#38bdf8",
      rose = "#fb7185",
      base = "#334155";
    const lerp = (a, b, t) => a + (b - a) * t;
    let running = true;
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      for (let y = 0; y < H + spacing; y += spacing) {
        for (let x = 0; x < W + spacing; x += spacing) {
          const d = Math.hypot(x - mouse.x, y - mouse.y);
          let R = r,
            c = base;
          if (d < 100) {
            const t = 1 - d / 100;
            R = lerp(r, r * 3.5, t);
            c = `rgb(${lerp(56, 251, t) | 0},${lerp(189, 113, t) | 0},${
              lerp(248, 133, t) | 0
            })`;
          } else c = ~~(x / spacing + y / spacing) & 1 ? rose : blue;
          ctx.beginPath();
          ctx.arc(x, y, R, 0, 6.283);
          ctx.fillStyle = c;
          ctx.globalAlpha = 0.75;
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }
    draw();
    return () => {
      running = false;
      window.removeEventListener("resize", resize);
    };
  }, []);
  // Card theme classes
  const cardBase =
    "relative px-8 py-10 max-w-lg w-full rounded-2xl ring-1 ring-white/5";
  const cardDark =
    "bg-[#111827]/90 text-gray-100 shadow-[0_0_20px_rgba(0,0,0,.65)]";
  const cardLight = "bg-white/70 backdrop-blur-xl text-slate-800 shadow-lg";
  const cardClass = `${cardBase} ${theme === "light" ? cardLight : cardDark}`;
  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden font-display"
      style={{ minHeight: "100vh" }}
    >
      {/* Theme Toggle */}
      <button
        className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-full bg-[#1e293b] hover:bg-[#334155] shadow-lg transition"
        aria-label="Toggle theme"
        onClick={() => setTheme(theme === "neon" ? "light" : "neon")}
        type="button"
      >
        {/* Moon Icon */}
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
        {/* Sun Icon */}
        <svg
          className={`w-6 h-6 text-yellow-400 ${
            theme !== "light" ? "hidden" : ""
          }`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="5" />
          <path
            d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M17.36 17.36l1.42 1.42
       M1 12h2M21 12h2M4.22 19.78l1.42-1.42M17.36 6.64l1.42-1.42"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {/* Dots Grid */}
      <canvas
        ref={canvasRef}
        className="fixed inset-0 w-full h-full -z-10"
        style={{ pointerEvents: "none" }}
      />
      {/* Card */}
      <div className={cardClass}>
        <div className="absolute -top-10 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary shadow-neon">
            <svg
              className="w-10 h-10 text-white"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path
                d="M5 12h14M12 5v14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        <h1 className="mt-12 text-5xl font-bold text-center text-primary drop-shadow">
          WordBattle
        </h1>
        <p className="mt-3 mb-8 text-center text-gray-300">
          Sharpen your mind. Duel friends. Dominate the grid.
        </p>
        {/* Username */}
        <form
          className="flex flex-col items-center gap-2 mb-8"
          onSubmit={(e) => e.preventDefault()}
        >
          <label
            htmlFor="username"
            className="text-gray-400 font-medium text-lg"
          >
            Your Username
          </label>
          <div className="flex items-center gap-2">
            <input
              id="username"
              maxLength={20}
              autoComplete="off"
              className="rounded-md bg-[#0f172a] border border-[#334155] px-4 py-2 text-lg font-semibold text-primary placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary transition"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button
              type="button"
              className="text-secondary hover:text-primary transition"
              title="Generate another username"
              onClick={() => setUsername(genUsername())}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
              >
                <path
                  d="M4 4v5h.582M20 20v-5h-.581 M5.635 19.364A9 9 0 1 1 12 21 a8.966 8.966 0 0 1-6.364-1.636"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </form>
        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-6 justify-center">
          <button
            className="flex-1 inline-block text-center rounded-xl px-6 py-4 text-lg font-bold bg-primary/90 hover:bg-primary border border-primary/60 hover:border-secondary shadow-neon transition"
            onClick={handleSinglePlayer}
          >
            Single Player
          </button>
          <a
            href="#"
            className="flex-1 inline-block text-center rounded-xl px-6 py-4 text-lg font-bold bg-secondary/90 hover:bg-secondary border border-secondary/60 hover:border-primary shadow-neon transition"
            onClick={handleMultiplayer}
          >
            Multiplayer
          </a>
        </div>
        <footer className="mt-8 text-center text-xs text-gray-500">
          © 2025 WordBattle. All rights reserved.
        </footer>
      </div>
    </div>
  );
}
