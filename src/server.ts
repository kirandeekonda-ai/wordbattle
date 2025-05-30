// Simple in-memory room management for demo
import { Server } from "socket.io";
import { createServer } from "http";
import express from "express";
import path from "path";
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" },
});
// Add score property to Player interface
interface Player {
  name: string;
  score?: number;
  round?: number; // Track current round
}
interface Room {
  code: string;
  players: Player[];
  max: number;
  settings?: any;
  locked?: boolean;
  words?: string[]; // Add words property for generated words
}
// Track all rooms/usernames per socket
const rooms: Record<string, Room> = {};
const socketUser: Record<
  string,
  Array<{ username: string; code: string }>
> = {};
io.on("connection", (socket) => {
  // Send available rooms
  socket.on("getRooms", () => {
    socket.emit(
      "rooms",
      Object.values(rooms).map((r) => ({
        code: r.code,
        players: r.players.length,
        max: r.max,
        locked: !!r.locked, // include locked
      }))
    );
  });
  // Create a new room
  socket.on("createRoom", ({ code, max, username }, cb) => {
    if (rooms[code]) {
      cb && cb({ error: "Room already exists" });
      return;
    }
    rooms[code] = { code, players: [{ name: username }], max, locked: false };
    socket.join(code);
    if (!socketUser[socket.id]) socketUser[socket.id] = [];
    socketUser[socket.id].push({ username, code });
    cb && cb({ success: true });
    io.emit(
      "rooms",
      Object.values(rooms).map((r) => ({
        code: r.code,
        players: r.players.length,
        max: r.max,
        locked: !!r.locked,
      }))
    );
    io.to(code).emit("roomPlayers", {
      code,
      players: rooms[code].players,
      max: rooms[code].max,
      locked: !!rooms[code].locked,
    });
  });
  // Join a room
  socket.on("joinRoom", ({ code, username }, cb) => {
    let room = rooms[code];
    if (!room) {
      room = rooms[code] = { code, players: [], max: 8, locked: false };
    }
    if (room.players.length === 0) {
      // Room is empty, treat as new host
      room.players = [{ name: username }];
      socket.join(code);
      if (!socketUser[socket.id]) socketUser[socket.id] = [];
      socketUser[socket.id].push({ username, code });
      io.emit(
        "rooms",
        Object.values(rooms).map((r) => ({
          code: r.code,
          players: r.players.length,
          max: r.max,
          locked: !!r.locked,
        }))
      );
      io.to(code).emit("roomPlayers", {
        code,
        players: room.players,
        max: room.max,
        locked: !!room.locked,
      });
      // Also emit to all clients so lobby UIs update player count and button state
      io.emit("roomPlayers", {
        code,
        players: room.players,
        max: room.max,
        locked: !!room.locked,
      });
      cb && cb({ success: true });
      // If game already started, emit gameStarted to this socket
      if (room.settings) {
        socket.emit("gameStarted", {
          code,
          settings: room.settings,
          players: room.players,
        });
      }
      return;
    }
    if (room.players.length >= room.max) {
      cb && cb({ error: "Room full or not found" });
      return;
    }
    if (!room.players.some((p) => p.name === username)) {
      room.players.push({ name: username });
    }
    socket.join(code);
    if (!socketUser[socket.id]) socketUser[socket.id] = [];
    socketUser[socket.id].push({ username, code });
    io.emit(
      "rooms",
      Object.values(rooms).map((r) => ({
        code: r.code,
        players: r.players.length,
        max: r.max,
        locked: !!r.locked,
      }))
    );
    io.to(code).emit("roomPlayers", {
      code,
      players: room.players,
      max: room.max,
      locked: !!room.locked,
    });
    cb && cb({ success: true });
    // If game already started, emit gameStarted to this socket
    if (room.locked) {
      socket.emit("gameStarted", {
        code,
        settings: room.settings,
        players: room.players,
        words: room.words, // always include words for late joiners
      });
    } else if (room.settings) {
      // If the room has settings but game not started, send settings to the new player
      socket.emit("roomSettingsUpdate", { code, settings: room.settings });
    }
  });
  // Send current player list for a room
  socket.on("getRoomPlayers", ({ code }) => {
    const room = rooms[code];
    if (room) {
      io.to(code).emit("roomPlayers", {
        code,
        players: room.players,
        max: room.max,
        locked: !!room.locked,
      });
    }
  });
  // Leave room
  socket.on("leaveRoom", ({ code, username }) => {
    const room = rooms[code];
    if (room) {
      room.players = room.players.filter((p) => p.name !== username);
      // If room is now empty, delete it
      if (room.players.length === 0) {
        delete rooms[code];
      }
      io.emit(
        "rooms",
        Object.values(rooms).map((r) => ({
          code: r.code,
          players: r.players.length,
          max: r.max,
          locked: !!r.locked,
        }))
      );
      io.to(code).emit("roomPlayers", {
        code,
        players: room.players,
        max: room ? room.max : undefined,
        locked: !!(room && room.locked),
      });
    }
    // Clean up socketUser
    if (socketUser[socket.id]) {
      socketUser[socket.id] = socketUser[socket.id].filter(
        (entry) => !(entry.code === code && entry.username === username)
      );
      if (socketUser[socket.id].length === 0) delete socketUser[socket.id];
    }
  });
  // Handle disconnect: remove user from all rooms they joined
  socket.on("disconnect", () => {
    const entries = socketUser[socket.id];
    if (entries) {
      entries.forEach(({ code, username }) => {
        const room = rooms[code];
        if (room) {
          room.players = room.players.filter((p) => p.name !== username);
          // Do NOT delete the room if empty; just leave players as []
        }
      });
      delete socketUser[socket.id];
      io.emit(
        "rooms",
        Object.values(rooms).map((r) => ({
          code: r.code,
          players: r.players.length,
          max: r.max,
          locked: !!r.locked,
        }))
      );
    }
  });
  // Room chat: broadcast to all in the room
  socket.on("roomChat", ({ code, username, text }) => {
    if (!code || !username || typeof text !== "string" || !text.trim()) return;
    // Optionally: profanity filter, message length limit, etc.
    io.to(code).emit("roomChat", { code, username, text });
  });
  // Handle room settings update from host
  socket.on("roomSettingsUpdate", ({ code, settings }) => {
    const room = rooms[code];
    if (!room) return;
    room.settings = settings;
    io.to(code).emit("roomSettingsUpdate", { code, settings });
  });
  // Listen for startGame event from client
  socket.on("startGame", async ({ code, settings, players }) => {
    console.log("[SERVER] startGame received", { code, settings, players });
    const room = rooms[code];
    if (!room) return;
    room.settings = settings;
    room.locked = true; // lock the room
    // Attach player names to room for game start
    room.players = players.map((name: string) => ({
      name,
      round: 0,
      score: 0,
    }));
    // Generate random words for this room based on rounds
    const numWords = settings.rounds || 5;
    // Use the ESM wrapper for random-words
    // @ts-ignore
    const getRandomWords: any = (await import("../randomWordsWrapper.mjs"))
      .default;
    const words = getRandomWords(numWords, 5, 8);
    room.words = words;
    // Log all sockets in the room
    const clients = Array.from(io.sockets.adapter.rooms.get(code) || []);
    console.log(`[SERVER] Sockets in room ${code}:`, clients);
    // Delay emission to ensure all clients are ready
    setTimeout(() => {
      console.log("[SERVER] emitting gameStarted", {
        code,
        settings,
        players: room.players,
        words,
      });
      if (!words || !Array.isArray(words) || words.length === 0) {
        console.error(
          "[SERVER] ERROR: No words generated for room",
          code,
          words
        );
      } else {
        console.log("[SERVER] First word for room", code, words[0]);
      }
      io.emit(
        "rooms",
        Object.values(rooms).map((r) => ({
          code: r.code,
          players: r.players.length,
          max: r.max,
          locked: !!r.locked,
        }))
      );
      io.to(code).emit("gameStarted", {
        code,
        settings,
        players: room.players,
        words: room.words, // always use the room's words property
      });
    }, 1000);
  });
  // Listen for playerMissed event from client
  socket.on("playerMissed", ({ code, name }) => {
    const room = rooms[code];
    if (!room) return;
    // Find player and advance their round
    const player = room.players.find((p) => p.name === name);
    if (player) {
      player.round = (typeof player.round === "number" ? player.round : 0) + 1;
    }
    // Check if all players have finished all rounds
    const totalRounds = room.settings?.rounds || 1;
    const allDone = room.players.every(
      (p) => (typeof p.round === "number" ? p.round : 0) >= totalRounds
    );
    if (allDone) {
      io.to(code).emit("gameOver", { code });
    } else {
      // Broadcast to all clients to advance to next round
      io.to(code).emit("nextRound", { code });
    }
  });
  // Listen for playerScored event from client
  socket.on("playerScored", ({ code, name, score }) => {
    const room = rooms[code];
    if (!room) return;
    // Ensure all players have a score property and round
    room.players.forEach((p) => {
      if (typeof p.score !== "number") p.score = 0;
      if (typeof p.round !== "number") p.round = 0;
    });
    // Update the score and advance round for the player
    const player = room.players.find((p) => p.name === name);
    if (player) {
      player.score = score;
      player.round = (typeof player.round === "number" ? player.round : 0) + 1;
      // Broadcast updated scores to all clients in the room
      io.to(code).emit("scoreUpdate", {
        code,
        players: room.players.map((p) => ({
          name: p.name,
          score: p.score || 0,
        })),
      });
    }
    // Check if all players have finished all rounds
    const totalRounds = room.settings?.rounds || 1;
    const allDone = room.players.every(
      (p) => (typeof p.round === "number" ? p.round : 0) >= totalRounds
    );
    if (allDone) {
      io.to(code).emit("gameOver", { code });
    } else {
      // Broadcast to all clients to advance to next round
      io.to(code).emit("nextRound", { code });
    }
  });
  // Handle room deletion when game is over
  socket.on("deleteRoom", ({ code }) => {
    if (rooms[code]) {
      delete rooms[code];
      io.emit(
        "rooms",
        Object.values(rooms).map((r) => ({
          code: r.code,
          players: r.players.length,
          max: r.max,
          locked: !!r.locked,
        }))
      );
    }
  });
  // Single-player: handle getWords event
  socket.on("getWords", async ({ count }) => {
    // Use the ESM wrapper for random-words
    // @ts-ignore
    const getRandomWords: any = (await import("../randomWordsWrapper.mjs"))
      .default;
    // Default to 10 words, 5-8 chars
    const num = typeof count === "number" && count > 0 ? count : 10;
    const words = getRandomWords(num, 5, 8);
    socket.emit("words", { words });
  });
});

// Serve static files from React build
app.use(express.static(path.join(__dirname, "../dist")));
// Fallback to index.html for SPA routes
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../dist", "index.html"));
});
const PORT = 4000;
httpServer.listen(PORT, () => {
  console.log("Socket.IO server running on port", PORT);
});
