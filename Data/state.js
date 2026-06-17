import { initGame } from "./data.js";

const globalState = initGame();

const initialGameState = {
    currentTurn: "WHITE",
    moveHistory: [],
    halfmoveClock: 0,
    fullmoveNumber: 1,
    lastMove: null,
    positionHistory: [],
    gameOver: false,
    result: null,
    awaitingPromotion: null,
    status: "ACTIVE",
    statusMessage: "White to move",
    winner: null,
    undoStack: [],
};

// additional meta state for game logic
const gameState = { ...initialGameState };

function resetGlobalState() {
    const freshBoard = initGame();
    globalState.splice(0, globalState.length, ...freshBoard);
    return globalState;
}

function resetGameState() {
    Object.keys(gameState).forEach((key) => {
        delete gameState[key];
    });
    Object.assign(gameState, JSON.parse(JSON.stringify(initialGameState)));
    return gameState;
}

function cloneGameStateForSnapshot() {
    return JSON.parse(JSON.stringify({
        currentTurn: gameState.currentTurn,
        moveHistory: gameState.moveHistory,
        halfmoveClock: gameState.halfmoveClock,
        fullmoveNumber: gameState.fullmoveNumber,
        lastMove: gameState.lastMove,
        positionHistory: gameState.positionHistory,
        gameOver: gameState.gameOver,
        result: gameState.result,
        awaitingPromotion: gameState.awaitingPromotion,
        status: gameState.status,
        statusMessage: gameState.statusMessage,
        winner: gameState.winner,
    }));
}

function createUndoSnapshot() {
    return {
        board: JSON.parse(JSON.stringify(globalState)),
        gameState: cloneGameStateForSnapshot(),
    };
}

function restoreBoardSnapshot(boardSnapshot) {
    const flatCurrent = globalState.flat();
    const flatSnapshot = boardSnapshot.flat();
    flatCurrent.forEach((square) => {
        const snapshotSquare = flatSnapshot.find((el) => el.id === square.id);
        square.piece = snapshotSquare && snapshotSquare.piece ? JSON.parse(JSON.stringify(snapshotSquare.piece)) : null;
        square.highlighted = false;
    });
    return globalState;
}

function restoreGameStateSnapshot(snapshot) {
    resetGameState();
    Object.assign(gameState, JSON.parse(JSON.stringify(snapshot)));
    gameState.undoStack = [];
    return gameState;
}

export { globalState, gameState, resetGlobalState, resetGameState, createUndoSnapshot, restoreBoardSnapshot, restoreGameStateSnapshot };
