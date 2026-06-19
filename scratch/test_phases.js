import { documentMock, root, elementsById } from './mock_dom.js';
import { globalState, gameState } from '../Data/state.js';
import { GlobalEvent, restartGame } from '../Events/global.js';
import * as pieces from '../Data/pieces.js';
import '../index.js';

// Let index.js initialize global events

// Helper to click elements by selector or data-action
function clickElementByAction(action) {
    const el = document.querySelector(`[data-action="${action}"]`);
    if (!el) throw new Error(`Button with action ${action} not found`);
    el.dispatchEvent({ type: 'click', target: el });
}

// Helper to click on a square
function clickSquare(squareId) {
    const el = document.getElementById(squareId);
    if (!el) throw new Error(`Square ${squareId} not found`);
    const img = el.querySelector('img');
    const target = img ? img : el;
    target.dispatchEvent({ type: 'click', target });
}

// Helper to play a complete move
function playMove(from, to) {
    clickSquare(from);
    clickSquare(to);
}

// Assertions helper
function assert(condition, message) {
    if (!condition) {
        console.error(`FAIL: ${message}`);
        process.exit(1);
    } else {
        console.log(`PASS: ${message}`);
    }
}

console.log("=== RUNNING PHASES 2, 3, 4 TEST SUITE ===");

// 1. Play some moves
restartGame();
playMove("e2", "e4");
playMove("d7", "d5");

// Verify undoStack has snapshots
assert(gameState.undoStack.length === 2, "undoStack has 2 snapshots");

// 2. Test PGN Generation
const pgnText = document.querySelector('[data-action="export-pgn"]') ? "found" : "not found";
assert(pgnText === "found", "Export PGN button exists in DOM");

// We can extract/invoke generatePGN via the global actions.
// Since generatePGN is local to global.js, we can inspect its output through console fall-back on downloadPGN call!
// Let's spy on console.log during downloadPGN call to check PGN structure.
let capturedLog = "";
const originalLog = console.log;
console.log = (...args) => {
    const msg = args[0];
    if (typeof msg === 'string' && msg.includes("PGN Export")) {
        capturedLog = args[1];
    } else {
        originalLog(...args);
    }
};

const origCreateObjectURL = URL.createObjectURL;
URL.createObjectURL = null;
clickElementByAction("export-pgn");
URL.createObjectURL = origCreateObjectURL;
console.log = originalLog;

assert(capturedLog.includes('[Event "Local Game"]'), "PGN has Event header");
assert(capturedLog.includes('[Site "Browser Chess"]'), "PGN has Site header");
assert(capturedLog.includes('[Date "'), "PGN has Date header");
assert(capturedLog.includes('[Result "*"]'), "PGN has Result header");
assert(capturedLog.includes('1. e4 d5 *'), "PGN contains correct moves and result notation");

// 3. Test Board Flip
const rootDiv = document.getElementById("root");
assert(rootDiv !== null, "#root board element exists");
assert(!rootDiv.classList.contains("flipped"), "Board is not flipped initially");

clickElementByAction("flip");
assert(rootDiv.classList.contains("flipped"), "Board is flipped after clicking Flip Board");

clickElementByAction("flip");
assert(!rootDiv.classList.contains("flipped"), "Board is unflipped after clicking Flip Board again");

// 4. Test Navigation Review Mode
assert(gameState.reviewIndex === null, "reviewIndex starts as null (live mode)");

// Click Prev
clickElementByAction("nav-prev");
assert(gameState.reviewIndex === 1, "reviewIndex is 1 after nav-prev");

const turnIndicator = document.getElementById("turnIndicator");
assert(turnIndicator.textContent === "Review Mode", "Turn indicator shows Review Mode");

const stateIndicator = document.getElementById("gameStateIndicator");
assert(stateIndicator.textContent === "REVIEW", "State indicator shows REVIEW");

// Click First
clickElementByAction("nav-first");
assert(gameState.reviewIndex === 0, "reviewIndex is 0 after nav-first");

// Verify that clicks on board are ignored during review mode
// Let's try to select white pawn at a2 (which would normally highlight its moves)
const a2Square = document.getElementById("a2");
clickSquare("a2");
assert(!a2Square.classList.contains("highlightYellow"), "Piece selection is blocked during review mode");

// Click Next
clickElementByAction("nav-next");
assert(gameState.reviewIndex === 1, "reviewIndex is 1 after nav-next");

// Click Next again -> should restore live play (index becomes null)
clickElementByAction("nav-next");
assert(gameState.reviewIndex === null, "reviewIndex is null (restored live play) after nav-next from end");
assert(turnIndicator.textContent !== "Review Mode", "Turn indicator restored after exiting review mode");

// Go to beginning, then jump to last/current
clickElementByAction("nav-first");
assert(gameState.reviewIndex === 0, "reviewIndex back to 0");
clickElementByAction("nav-last");
assert(gameState.reviewIndex === null, "reviewIndex restored to null after nav-last");

console.log("=== ALL PHASES 2, 3, 4 TESTS PASSED ===");
