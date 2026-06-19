import { documentMock, root } from './mock_dom.js';
import { globalState, gameState } from '../Data/state.js';
import { bootGame } from '../index.js';
import { restartGame, loadFEN } from '../Events/global.js';
import { parseFEN, toFEN } from '../Helper/fen.js';

function clickSquare(squareId) {
    const el = document.getElementById(squareId);
    if (!el) throw new Error(`Square ${squareId} not found`);
    const img = el.querySelector('img');
    const target = img ? img : el;
    target.dispatchEvent({ type: 'click', target });
}

function playMove(from, to) {
    clickSquare(from);
    clickSquare(to);
}

function assert(condition, message) {
    if (!condition) {
        console.error(`FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`PASS: ${message}`);
    }
}

console.log("=== RUNNING GAME MODES TEST SUITE ===");

// 1. Test FEN Parser & Stringifier
const startFEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const parsed = parseFEN(startFEN);
assert(parsed.currentTurn === "WHITE", "Start FEN turn parsed correctly");
assert(parsed.halfmoveClock === 0, "Start FEN halfmove clock parsed correctly");
assert(parsed.fullmoveNumber === 1, "Start FEN fullmove number parsed correctly");
assert(parsed.board[0][0].piece.piece_name === "BLACK_ROOK", "Start FEN piece placement parsed correctly");

// Load FEN
loadFEN(startFEN);
const generated = toFEN(globalState, gameState);
assert(generated.startsWith("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w"), "toFEN output matches start FEN state");

// Test custom FEN loading (Scholar's mate position)
const scholarsFEN = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 4";
loadFEN(scholarsFEN);
assert(gameState.currentTurn === "BLACK", "Custom FEN turn loaded correctly");
const blackKnight = globalState.flat().find(s => s.id === "c6")?.piece;
assert(blackKnight && blackKnight.piece_name === "BLACK_KNIGHT", "Custom FEN piece placed correctly");

// 2. Test Mode Booting
bootGame("ANALYSIS");
assert(gameState.mode === "ANALYSIS", "Successfully booted into ANALYSIS mode");
assert(!document.getElementById("clocksCard").classList.contains("hidden") === false, "Clocks card hidden in ANALYSIS mode");

bootGame("LOCAL", { timeControl: 300 });
assert(gameState.mode === "LOCAL", "Successfully booted into LOCAL mode");
assert(gameState.timeControl === 300, "Time control set correctly to 300 seconds");
assert(gameState.clocks.WHITE === 300, "White clock initialized to 300 seconds");
assert(!document.getElementById("clocksCard").classList.contains("hidden") === true, "Clocks card shown in LOCAL mode");

// 3. Test Timer ticking
assert(gameState.clockInterval !== null, "Clock interval started in Local Mode");

// Simulate time ticking down
const prevWhiteTime = gameState.clocks.WHITE;
console.log("Simulating clock tick...");
await new Promise(resolve => setTimeout(resolve, 1200));
assert(gameState.clocks.WHITE < prevWhiteTime, "Clock ticks down for active player");

// 4. Test Auto-flipping in Local Mode
bootGame("LOCAL", { timeControl: 300 });
const initialFlipped = root.classList.contains("flipped");

// Play a move
playMove("e2", "e4");

// Verify board flips automatically after the move
assert(root.classList.contains("flipped") !== initialFlipped, "Board flips automatically in LOCAL mode");

// 5. Test Online Mode Placeholder
bootGame("ONLINE");
assert(gameState.mode === "ONLINE", "Successfully booted into ONLINE mode");
assert(!document.getElementById("onlineCard").classList.contains("hidden") === true, "Online card shown in ONLINE mode");

console.log("=== ALL GAME MODES TESTS PASSED ===");
process.exit(0);
