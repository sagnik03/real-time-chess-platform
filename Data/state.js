import { initGame } from "./data.js";

const globalState = initGame();

// additional meta state for game logic
const gameState = {
    currentTurn: "WHITE", // or 'BLACK'
    moveHistory: [],
    halfmoveClock: 0,
    fullmoveNumber: 1,
    lastMove: null,
};

export { globalState, gameState };
