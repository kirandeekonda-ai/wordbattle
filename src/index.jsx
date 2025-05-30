import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "../LandingPage";
import GamePage from "../GamePage";
import WordbattleMatch from "../WordBattleMatch";
import WordbattleRoom from "../WordBattleRoom";
import WordbattleGameMulti from "../WordbattleGameMulti";
const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/game" element={<GamePage />} />
      <Route path="/multiplayer" element={<WordbattleMatch />} />
      <Route path="/room" element={<WordbattleRoom />} />
      <Route path="/multiplayer/game" element={<WordbattleGameMulti />} />
    </Routes>
  </BrowserRouter>
);
