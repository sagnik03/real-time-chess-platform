import { documentMock, root, elementsById } from './mock_dom.js';
import { globalState, gameState } from '../Data/state.js';
import { GlobalEvent, restartGame, undoMove } from '../Events/global.js';
import { getLegalMovesForPiece, isKingInCheck, insufficientMaterial } from '../Data/engine.js';
import * as pieces from '../Data/pieces.js';

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

// Helper to trigger promotion modal choice
function selectPromotion(choice) {
    const modal = document.getElementById('promotionModal');
    if (!modal) throw new Error("Promotion modal not found");
    const panel = modal.children[0];
    const buttons = panel.children; // panel contains title + 4 buttons
    const char = choice[0].toUpperCase();
    for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].textContent === char) {
            buttons[i].dispatchEvent({ type: 'click', target: buttons[i] });
            return;
        }
    }
    throw new Error(`Promotion choice ${choice} not found in modal`);
}

function getSquare(id) {
    return globalState.flat().find(s => s.id === id);
}

const tests = {};

// Test 1: White kingside castling
tests['1. White kingside castling'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('h1', 'WHITE_ROOK');
    syncDOM();
    // Verify candidate moves contain g1
    const king = getLegalMovesForPiece(globalState, getSquare('e1').piece, gameState);
    if (!king.includes('g1')) return "Failed: g1 not in legal moves for White King";
    playMove('e1', 'g1');
    // Verify new positions
    const kingSq = getSquare('g1');
    const rookSq = getSquare('f1');
    if (!kingSq.piece || kingSq.piece.piece_name !== 'WHITE_KING') return "Failed: King did not move to g1";
    if (!rookSq.piece || rookSq.piece.piece_name !== 'WHITE_ROOK') return "Failed: Rook did not move to f1";
    return "Passed";
};

// Test 2: White queenside castling
tests['2. White queenside castling'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('a1', 'WHITE_ROOK');
    syncDOM();
    const king = getLegalMovesForPiece(globalState, getSquare('e1').piece, gameState);
    if (!king.includes('c1')) return "Failed: c1 not in legal moves for White King";
    playMove('e1', 'c1');
    const kingSq = getSquare('c1');
    const rookSq = getSquare('d1');
    if (!kingSq.piece || kingSq.piece.piece_name !== 'WHITE_KING') return "Failed: King did not move to c1";
    if (!rookSq.piece || rookSq.piece.piece_name !== 'WHITE_ROOK') return "Failed: Rook did not move to d1";
    return "Passed";
};

// Test 3: Black kingside castling
tests['3. Black kingside castling'] = () => {
    restartGame();
    clearBoard();
    setPiece('e8', 'BLACK_KING');
    setPiece('h8', 'BLACK_ROOK');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    const king = getLegalMovesForPiece(globalState, getSquare('e8').piece, gameState);
    if (!king.includes('g8')) return "Failed: g8 not in legal moves for Black King";
    playMove('e8', 'g8');
    const kingSq = getSquare('g8');
    const rookSq = getSquare('f8');
    if (!kingSq.piece || kingSq.piece.piece_name !== 'BLACK_KING') return "Failed: King did not move to g8";
    if (!rookSq.piece || rookSq.piece.piece_name !== 'BLACK_ROOK') return "Failed: Rook did not move to f8";
    return "Passed";
};

// Test 4: Black queenside castling
tests['4. Black queenside castling'] = () => {
    restartGame();
    clearBoard();
    setPiece('e8', 'BLACK_KING');
    setPiece('a8', 'BLACK_ROOK');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    const king = getLegalMovesForPiece(globalState, getSquare('e8').piece, gameState);
    if (!king.includes('c8')) return "Failed: c8 not in legal moves for Black King";
    playMove('e8', 'c8');
    const kingSq = getSquare('c8');
    const rookSq = getSquare('d8');
    if (!kingSq.piece || kingSq.piece.piece_name !== 'BLACK_KING') return "Failed: King did not move to c8";
    if (!rookSq.piece || rookSq.piece.piece_name !== 'BLACK_ROOK') return "Failed: Rook did not move to d8";
    return "Passed";
};

// Test 5: Illegal castling through check
tests['5. Illegal castling through check'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('h1', 'WHITE_ROOK');
    setPiece('f8', 'BLACK_ROOK'); // attacks f1
    syncDOM();
    const king = getLegalMovesForPiece(globalState, getSquare('e1').piece, gameState);
    if (king.includes('g1')) return "Failed: castling allowed through check (f1 attacked)";
    return "Passed";
};

// Test 6: Illegal castling while in check
tests['6. Illegal castling while in check'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('h1', 'WHITE_ROOK');
    setPiece('e8', 'BLACK_ROOK'); // attacks e1 (checks king)
    syncDOM();
    const king = getLegalMovesForPiece(globalState, getSquare('e1').piece, gameState);
    if (king.includes('g1')) return "Failed: castling allowed while in check (e1 attacked)";
    return "Passed";
};

// Test 7: En passant (white)
tests['7. En passant (white)'] = () => {
    restartGame();
    clearBoard();
    setPiece('e5', 'WHITE_PAWN');
    setPiece('d7', 'BLACK_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('e8', 'BLACK_KING');
    syncDOM();
    // Black plays d7-d5
    gameState.currentTurn = 'BLACK';
    playMove('d7', 'd5');
    // Verify white has EP move on d6
    const moves = getLegalMovesForPiece(globalState, getSquare('e5').piece, gameState);
    if (!moves.includes('d6')) return "Failed: d6 not in legal moves for White Pawn";
    playMove('e5', 'd6');
    const pawnSq = getSquare('d6');
    const capturedSq = getSquare('d5');
    if (!pawnSq.piece || pawnSq.piece.piece_name !== 'WHITE_PAWN') return "Failed: Pawn did not move to d6";
    if (capturedSq.piece) return "Failed: captured Black Pawn not removed from d5";
    return "Passed";
};

// Test 8: En passant (black)
tests['8. En passant (black)'] = () => {
    restartGame();
    clearBoard();
    setPiece('d4', 'BLACK_PAWN');
    setPiece('e2', 'WHITE_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('e8', 'BLACK_KING');
    syncDOM();
    // White plays e2-e4
    gameState.currentTurn = 'WHITE';
    playMove('e2', 'e4');
    // Verify black has EP move on e3
    const moves = getLegalMovesForPiece(globalState, getSquare('d4').piece, gameState);
    if (!moves.includes('e3')) return "Failed: e3 not in legal moves for Black Pawn";
    playMove('d4', 'e3');
    const pawnSq = getSquare('e3');
    const capturedSq = getSquare('e4');
    if (!pawnSq.piece || pawnSq.piece.piece_name !== 'BLACK_PAWN') return "Failed: Pawn did not move to e3";
    if (capturedSq.piece) return "Failed: captured White Pawn not removed from e4";
    return "Passed";
};

// Test 9: Pawn promotion to Queen
tests['9. Pawn promotion to Queen'] = () => {
    restartGame();
    clearBoard();
    setPiece('e7', 'WHITE_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    playMove('e7', 'e8');
    selectPromotion('QUEEN');
    const sq = getSquare('e8');
    if (!sq.piece || sq.piece.piece_name !== 'WHITE_QUEEN') return "Failed: piece at e8 is not White Queen";
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (lastMove.san !== 'e8=Q+') return `Failed: incorrect SAN, got ${lastMove.san}`;
    return "Passed";
};

// Test 10: Pawn promotion to Rook
tests['10. Pawn promotion to Rook'] = () => {
    restartGame();
    clearBoard();
    setPiece('e7', 'WHITE_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    playMove('e7', 'e8');
    selectPromotion('ROOK');
    const sq = getSquare('e8');
    if (!sq.piece || sq.piece.piece_name !== 'WHITE_ROOK') return "Failed: piece at e8 is not White Rook";
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (lastMove.san !== 'e8=R+') return `Failed: incorrect SAN, got ${lastMove.san}`;
    return "Passed";
};

// Test 11: Pawn promotion to Bishop
tests['11. Pawn promotion to Bishop'] = () => {
    restartGame();
    clearBoard();
    setPiece('e7', 'WHITE_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    playMove('e7', 'e8');
    selectPromotion('BISHOP');
    const sq = getSquare('e8');
    if (!sq.piece || sq.piece.piece_name !== 'WHITE_BISHOP') return "Failed: piece at e8 is not White Bishop";
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (lastMove.san !== 'e8=B') return `Failed: incorrect SAN, got ${lastMove.san}`;
    return "Passed";
};

// Test 12: Pawn promotion to Knight
tests['12. Pawn promotion to Knight'] = () => {
    restartGame();
    clearBoard();
    setPiece('e7', 'WHITE_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    playMove('e7', 'e8');
    selectPromotion('KNIGHT');
    const sq = getSquare('e8');
    if (!sq.piece || sq.piece.piece_name !== 'WHITE_KNIGHT') return "Failed: piece at e8 is not White Knight";
    const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
    if (lastMove.san !== 'e8=N') return `Failed: incorrect SAN, got ${lastMove.san}`;
    return "Passed";
};

// Test 13: Check detection
tests['13. Check detection'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('e8', 'BLACK_QUEEN');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    playMove('e8', 'e4');
    if (gameState.status !== 'CHECK') return `Failed: status is ${gameState.status}, expected CHECK`;
    const kingSquareEl = document.getElementById('e1');
    if (!kingSquareEl.classList.contains('checkKing')) return "Failed: White King square does not have checkKing class";
    return "Passed";
};

// Test 14: Double check
tests['14. Double check'] = () => {
    restartGame();
    clearBoard();
    setPiece('d1', 'WHITE_KING');
    setPiece('d8', 'BLACK_ROOK');
    setPiece('d3', 'BLACK_KNIGHT');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    playMove('d3', 'f2');
    if (gameState.status !== 'CHECK') return `Failed: status is not CHECK (got ${gameState.status})`;
    setPiece('f1', 'WHITE_ROOK');
    syncDOM();
    const rookMoves = getLegalMovesForPiece(globalState, getSquare('f1').piece, gameState);
    if (rookMoves.length > 0) return `Failed: Rook has legal moves during double check: ${rookMoves.join(', ')}`;
    return "Passed";
};

// Test 15: Checkmate
tests['15. Checkmate'] = () => {
    restartGame();
    clearBoard();
    setPiece('h1', 'WHITE_KING');
    setPiece('d2', 'BLACK_QUEEN');
    setPiece('f3', 'BLACK_BISHOP');
    setPiece('a8', 'BLACK_KING');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    playMove('d2', 'g2');
    if (gameState.status !== 'CHECKMATE') return `Failed: status is ${gameState.status}, expected CHECKMATE`;
    if (gameState.winner !== 'BLACK') return `Failed: winner is ${gameState.winner}, expected BLACK`;
    return "Passed";
};

// Test 16: Stalemate
tests['16. Stalemate'] = () => {
    restartGame();
    clearBoard();
    setPiece('h1', 'WHITE_KING');
    setPiece('f2', 'BLACK_KING');
    setPiece('d3', 'BLACK_QUEEN');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    playMove('d3', 'g3');
    if (gameState.status !== 'STALEMATE') return `Failed: status is ${gameState.status}, expected STALEMATE`;
    return "Passed";
};

// Test 17: Threefold repetition
tests['17. Threefold repetition'] = () => {
    restartGame();
    // Starting position is already synced in restartGame()
    playMove('g1', 'f3'); // W1
    playMove('g8', 'f6'); // B1
    playMove('f3', 'g1'); // W2
    playMove('f6', 'g8'); // B2
    playMove('g1', 'f3'); // W3
    playMove('g8', 'f6'); // B3
    playMove('f3', 'g1'); // W4
    playMove('f6', 'g8'); // B4
    if (gameState.status !== 'DRAW') return `Failed: status is ${gameState.status}, expected DRAW`;
    if (!gameState.statusMessage.includes('threefold')) return `Failed: message is ${gameState.statusMessage}`;
    return "Passed";
};

// Test 18: Fifty-move rule
tests['18. Fifty-move rule'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('e8', 'BLACK_KING');
    setPiece('a1', 'WHITE_ROOK');
    setPiece('h8', 'BLACK_ROOK');
    syncDOM();
    gameState.halfmoveClock = 99;
    playMove('a1', 'b1');
    if (gameState.status !== 'DRAW') return `Failed: status is ${gameState.status}, expected DRAW`;
    if (!gameState.statusMessage.includes('fifty-move')) return `Failed: message is ${gameState.statusMessage}`;
    return "Passed";
};

// Test 19: Insufficient material
tests['19. Insufficient material'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('e8', 'BLACK_KING');
    setPiece('c1', 'WHITE_BISHOP');
    syncDOM();
    playMove('c1', 'd2');
    if (gameState.status !== 'DRAW') return `Failed: status is ${gameState.status}, expected DRAW`;
    if (!gameState.statusMessage.includes('insufficient material')) return `Failed: message is ${gameState.statusMessage}`;
    return "Passed";
};

// Test 20: Multiple undo operations
tests['20. Multiple undo operations'] = () => {
    restartGame();
    playMove('e2', 'e4');
    playMove('e7', 'e5');
    playMove('g1', 'f3');
    undoMove();
    undoMove();
    undoMove();
    const e4 = getSquare('e4');
    const e2 = getSquare('e2');
    if (e4.piece || !e2.piece || e2.piece.piece_name !== 'WHITE_PAWN') return "Failed: undo did not restore start board";
    if (gameState.currentTurn !== 'WHITE') return "Failed: turn not WHITE";
    return "Passed";
};

// Test 21: Undo after castling
tests['21. Undo after castling'] = () => {
    restartGame();
    clearBoard();
    setPiece('e1', 'WHITE_KING');
    setPiece('h1', 'WHITE_ROOK');
    syncDOM();
    playMove('e1', 'g1');
    undoMove();
    const e1 = getSquare('e1');
    const h1 = getSquare('h1');
    if (!e1.piece || e1.piece.piece_name !== 'WHITE_KING') return "Failed: King not restored to e1";
    if (!h1.piece || h1.piece.piece_name !== 'WHITE_ROOK') return "Failed: Rook not restored to h1";
    return "Passed";
};

// Test 22: Undo after en passant
tests['22. Undo after en passant'] = () => {
    restartGame();
    clearBoard();
    setPiece('e5', 'WHITE_PAWN');
    setPiece('d7', 'BLACK_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('e8', 'BLACK_KING');
    syncDOM();
    gameState.currentTurn = 'BLACK';
    playMove('d7', 'd5');
    playMove('e5', 'd6');
    undoMove();
    const e5 = getSquare('e5');
    const d5 = getSquare('d5');
    if (!e5.piece || e5.piece.piece_name !== 'WHITE_PAWN') return "Failed: White pawn not restored to e5";
    if (!d5.piece || d5.piece.piece_name !== 'BLACK_PAWN') return "Failed: Black pawn not restored to d5";
    return "Passed";
};

// Test 23: Undo after promotion
tests['23. Undo after promotion'] = () => {
    restartGame();
    clearBoard();
    setPiece('e7', 'WHITE_PAWN');
    setPiece('e1', 'WHITE_KING');
    setPiece('h8', 'BLACK_KING');
    syncDOM();
    playMove('e7', 'e8');
    selectPromotion('KNIGHT');
    undoMove();
    const e7 = getSquare('e7');
    const e8 = getSquare('e8');
    if (!e7.piece || e7.piece.piece_name !== 'WHITE_PAWN') return "Failed: White pawn not restored to e7";
    if (e8.piece) return "Failed: piece still on e8 after undo";
    return "Passed";
};

// Run all tests
const results = {};
for (const [name, fn] of Object.entries(tests)) {
    try {
        results[name] = fn();
    } catch (e) {
        results[name] = `Error: ${e.message}\n${e.stack}`;
    }
}

// Print results
console.log("=== TEST SUITE RESULTS ===");
for (const [name, res] of Object.entries(results)) {
    console.log(`${name}: ${res}`);
}
