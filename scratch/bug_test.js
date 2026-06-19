import { documentMock, root, elementsById } from './mock_dom.js';
import { globalState, gameState } from '../Data/state.js';
import { GlobalEvent, restartGame } from '../Events/global.js';
import { getLegalMovesForPiece } from '../Data/engine.js';

// Initialize global events and rendering
GlobalEvent();

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

// Helper to clear the board
function clearBoard() {
    globalState.flat().forEach(sq => {
        sq.piece = null;
    });
}

// Helper to sync the DOM with globalState
function syncDOM() {
    const allSquares = globalState.flat();
    allSquares.forEach((square) => {
        const squareEl = document.getElementById(square.id);
        if (!squareEl) return;
        squareEl.innerHTML = "";
        if (square.piece) {
            const pieceImg = document.createElement("img");
            pieceImg.src = square.piece.img;
            pieceImg.classList.add("piece");
            pieceImg.alt = square.piece.piece_name.replace(/_/g, " ").toLowerCase();
            pieceImg.setAttribute("draggable", "false");
            pieceImg.setAttribute("aria-label", pieceImg.alt);
            squareEl.appendChild(pieceImg);
        }
    });
}

// Helper to set a piece on a square
function setPiece(id, pieceName) {
    const sq = globalState.flat().find(s => s.id === id);
    if (!sq) throw new Error(`Invalid square ${id}`);
    if (!pieceName) {
        sq.piece = null;
    } else {
        const color = pieceName.startsWith('WHITE') ? 'white' : 'black';
        const short = pieceName.split('_')[1];
        let letter = short === 'KNIGHT' ? 'N' : short[0];
        if (short === 'PAWN') letter = 'P';
        const img = `Assets/images/pieces/${color}/${color[0]}${letter}.svg`;
        sq.piece = {
            current_position: id,
            img,
            piece_name: pieceName
        };
    }
}

function getSquare(id) {
    return globalState.flat().find(s => s.id === id);
}

// Setup check scenario
restartGame();
clearBoard();
setPiece('e1', 'WHITE_KING');
setPiece('e8', 'BLACK_QUEEN');
setPiece('f3', 'WHITE_BISHOP');
setPiece('h8', 'BLACK_KING');
syncDOM();

console.log("Turn before move:", gameState.currentTurn);
console.log("Board status before move:", gameState.status);

// Black Queen moves to e4 to put White King in check
gameState.currentTurn = 'BLACK';
playMove('e8', 'e4');

console.log("Turn after check:", gameState.currentTurn);
console.log("Board status after check:", gameState.status);

// Try to move Bishop f3 to e2 (blocking the check)
console.log("--- Trying to play Bishop f3 to e2 ---");
const f3Sq = getSquare('f3');
console.log("f3 piece:", f3Sq.piece);
const legalMoves = getLegalMovesForPiece(globalState, f3Sq.piece, gameState);
console.log("Legal moves for Bishop at f3:", legalMoves);

// Click f3 to select Bishop
clickSquare('f3');
// Print highlighted squares in DOM
const highlighted = globalState.flat().filter(sq => sq.highlighted).map(sq => sq.id);
console.log("Highlighted squares in state:", highlighted);

// Attempt to move to e2
clickSquare('e2');
console.log("f3 piece after move attempt:", getSquare('f3').piece);
console.log("e2 piece after move attempt:", getSquare('e2').piece);
