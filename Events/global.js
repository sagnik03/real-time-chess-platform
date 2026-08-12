import { ROOT_DIV } from "../Helper/constants.js";
import { globalState, gameState, resetGlobalState, resetGameState, restoreBoardSnapshot, restoreGameStateSnapshot } from "../Data/state.js";
import { renderHighlight, clearHighlight, selfHighlight, clearPreviousSelfHighlight, moveElement } from "../Render/main.js";
import { getLegalMovesForPiece, cloneBoard, isKingInCheck } from "../Data/engine.js";
import { toSAN } from "../Data/notation.js";
import { hasAnyLegalMoves, generatePositionKey, insufficientMaterial } from "../Data/engine.js";
import { initGameRender } from "../Render/main.js";
import * as pieces from "../Data/pieces.js";
import { parseFEN, toFEN } from "../Helper/fen.js";

let selfHighlightState = null;
let moveState = null;
let clockIntervalId = null;

export function clearIntervals() {
    if (clockIntervalId) {
        clearInterval(clockIntervalId);
        clockIntervalId = null;
    }
}

export function startClock() {
    clearIntervals();
    if ((gameState.mode !== "LOCAL" && gameState.mode !== "ONLINE") || gameState.gameOver) return;
    updateClockUI();
    clockIntervalId = setInterval(() => {
        const activeTurn = gameState.currentTurn;
        if (gameState.clocks && gameState.clocks[activeTurn] !== undefined) {
            gameState.clocks[activeTurn]--;
            updateClockUI();
            if (gameState.clocks[activeTurn] <= 0) {
                clearIntervals();
                const winner = activeTurn === "WHITE" ? "BLACK" : "WHITE";
                const winnerText = winner === "WHITE" ? "White" : "Black";
                
                if (activeTurn === gameState.playerColor && gameState.mode === "ONLINE") {
                    socket.emit('timeout', { roomId: gameState.roomId, loserColor: activeTurn });
                } else if (gameState.mode !== "ONLINE") {
                    setStatus("TIMEOUT", `${winnerText} wins on time`, winner);
                }
            }
        }
    }, 1000);
}

export function updateClockUI() {
    const whiteClockVal = document.getElementById("whiteClock");
    const blackClockVal = document.getElementById("blackClock");
    if (whiteClockVal && gameState.clocks) {
        whiteClockVal.textContent = formatTime(gameState.clocks.WHITE);
    }
    if (blackClockVal && gameState.clocks) {
        blackClockVal.textContent = formatTime(gameState.clocks.BLACK);
    }
    
    const whiteCard = document.getElementById("whiteClockCard");
    const blackCard = document.getElementById("blackClockCard");
    if (gameState.currentTurn === "WHITE") {
        whiteCard?.classList.add("active-clock");
        blackCard?.classList.remove("active-clock");
    } else {
        blackCard?.classList.add("active-clock");
        whiteCard?.classList.remove("active-clock");
    }
}

function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function afterMoveCompletion() {
    if (gameState.mode === "ANALYSIS") {
        const fenInput = document.getElementById("fenInput");
        if (fenInput) {
            fenInput.value = toFEN(globalState, gameState);
        }
    }
    
    if (gameState.mode === "ONLINE" && gameState.moveHistory.length > 0) {
        const lastMove = gameState.moveHistory[gameState.moveHistory.length - 1];
        const lastMoveColor = lastMove.piece.startsWith("WHITE") ? "WHITE" : "BLACK";
        if (lastMoveColor === gameState.playerColor && !lastMove.opponentSync) {
            if (socket) {
                socket.emit('makeMove', {
                    roomId: gameState.roomId,
                    from: lastMove.from,
                    to: lastMove.to,
                    promotion: lastMove.promotedTo ? lastMove.promotedTo.split('_')[1] : null,
                    san: lastMove.san,
                    clocks: gameState.clocks
                });
            }
        }
    }

    if (!gameState.gameOver) {
        startClock();
        if (gameState.mode === "LOCAL") {
            flipBoard();
        }
    } else {
        clearIntervals();
    }
}

export function loadFEN(fenStr) {
    try {
        const { board, currentTurn, halfmoveClock, fullmoveNumber, enPassant } = parseFEN(fenStr);
        gameState.undoStack = [];
        gameState.reviewIndex = null;
        gameState.awaitingPromotion = null;
        
        restoreBoardSnapshot(board);
        
        gameState.currentTurn = currentTurn;
        gameState.halfmoveClock = halfmoveClock;
        gameState.fullmoveNumber = fullmoveNumber;
        gameState.moveHistory = [];
        gameState.lastMove = null;
        if (enPassant) {
            const targetRank = parseInt(enPassant[1], 10);
            const file = enPassant[0];
            const enemyRank = targetRank === 3 ? 4 : 5;
            const startRank = targetRank === 3 ? 2 : 7;
            gameState.lastMove = {
                piece: targetRank === 3 ? 'WHITE_PAWN' : 'BLACK_PAWN',
                from: `${file}${startRank}`,
                to: `${file}${enemyRank}`
            };
        }
        
        const key = generatePositionKey(globalState, gameState);
        gameState.positionHistory = [key];
        
        setStatus("ACTIVE", `${currentTurn === "WHITE" ? "White" : "Black"} to move`, null);
        refreshBoardUI();
        clearKingCheckHighlight();
        updateKingCheckHighlight();
        renderMoveHistory();
        updateNavigationButtons();
        
        const newFen = toFEN(globalState, gameState);
        const fenInput = document.getElementById("fenInput");
        if (fenInput) fenInput.value = newFen;
    } catch (e) {
        alert("Invalid FEN string: " + e.message);
    }
}

export function copyFENToClipboard() {
    const fenInput = document.getElementById("fenInput");
    if (!fenInput) return;
    fenInput.select();
    fenInput.setSelectionRange(0, 99999);
    try {
        document.execCommand("copy");
        const btn = document.getElementById("btnCopyFEN");
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = "Copied!";
            setTimeout(() => { btn.textContent = originalText; }, 1500);
        }
    } catch (err) {
        console.error("Copy FEN failed", err);
    }
}

function getKingSquare(color) {
    return globalState.flat().find((square) => square.piece && square.piece.piece_name === `${color}_KING`);
}

function clearKingCheckHighlight() {
    globalState.flat().forEach((square) => {
        const squareEl = document.getElementById(square.id);
        if (squareEl) squareEl.classList.remove("checkKing");
    });
}

function updateKingCheckHighlight() {
    clearKingCheckHighlight();
    const whiteKing = getKingSquare("WHITE");
    const blackKing = getKingSquare("BLACK");
    if (whiteKing && isKingInCheck(globalState, "WHITE")) {
        const squareEl = document.getElementById(whiteKing.id);
        if (squareEl) squareEl.classList.add("checkKing");
    }
    if (blackKing && isKingInCheck(globalState, "BLACK")) {
        const squareEl = document.getElementById(blackKing.id);
        if (squareEl) squareEl.classList.add("checkKing");
    }
}

function setStatus(status, message, winner = null) {
    gameState.status = status;
    gameState.statusMessage = message;
    gameState.winner = winner;
    gameState.gameOver = status !== "ACTIVE" && status !== "CHECK";
    const bannerEl = document.getElementById("gameBanner");
    if (bannerEl) {
        bannerEl.dataset.status = status.toLowerCase();
        bannerEl.textContent = message;
    }
    const statusMessageEl = document.getElementById("statusMessage");
    if (statusMessageEl) statusMessageEl.textContent = message;
    const gameStateEl = document.getElementById("gameStateIndicator");
    if (gameStateEl) gameStateEl.textContent = status;
    const winnerEl = document.getElementById("winnerIndicator");
    if (winnerEl) winnerEl.textContent = winner ? winner : "-";
}

function clearSelection() {
    clearHighlight();
    clearPreviousSelfHighlight(selfHighlightState);
    selfHighlightState = null;
    moveState = null;
}

function clearSquareDOM(squareEl) {
    if (!squareEl) return;
    const img = squareEl.querySelector('img');
    if (img) img.remove();
    const highlight = squareEl.querySelector('.highlight');
    if (highlight) highlight.remove();
}

function refreshBoardUIFromBoard(board) {
    const allSquares = board.flat();
    allSquares.forEach((square) => {
        const squareEl = document.getElementById(square.id);
        if (!squareEl) return;
        clearSquareDOM(squareEl);
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

function refreshBoardUI() {
    refreshBoardUIFromBoard(globalState);
    updateKingCheckHighlight();
}

function pushUndoSnapshot() {
    gameState.undoStack = gameState.undoStack || [];
    gameState.undoStack.push({
        board: JSON.parse(JSON.stringify(globalState)),
        gameState: JSON.parse(JSON.stringify({
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
        })),
    });
}

function updateTerminationStatus() {
    const opponent = gameState.currentTurn;
    const opponentInCheck = isKingInCheck(globalState, opponent);
    const opponentHasMoves = hasAnyLegalMoves(globalState, opponent, gameState);
    const statusPrefix = opponent === "WHITE" ? "White" : "Black";
    if (opponentInCheck && !opponentHasMoves) {
        setStatus("CHECKMATE", `${statusPrefix} is checkmated. ${opponent === "WHITE" ? "Black" : "White"} wins.`, opponent === "WHITE" ? "BLACK" : "WHITE");
        return true;
    }
    if (!opponentInCheck && !opponentHasMoves) {
        setStatus("STALEMATE", `Draw by stalemate.`, null);
        return true;
    }
    if ((gameState.halfmoveClock || 0) >= 100) {
        setStatus("DRAW", `Draw by fifty-move rule.`, null);
        return true;
    }
    try {
        const hist = gameState.positionHistory || [];
        const lastKey = hist[hist.length - 1];
        const count = hist.filter((k) => k === lastKey).length;
        if (count >= 3) {
            setStatus("DRAW", `Draw by threefold repetition.`, null);
            return true;
        }
    } catch (error) {
        console.error(error);
    }
    try {
        if (insufficientMaterial(globalState)) {
            setStatus("DRAW", `Draw by insufficient material.`, null);
            return true;
        }
    } catch (error) {
        console.error(error);
    }
    if (opponentInCheck) {
        setStatus("CHECK", `${statusPrefix} is in check.`, null);
    } else {
        setStatus("ACTIVE", `${opponent === "WHITE" ? "White" : "Black"} to move`, null);
    }
    return false;
}

function syncTurnIndicator() {
    const turnIndicator = document.getElementById("turnIndicator");
    if (!turnIndicator) return;
    turnIndicator.textContent = gameState.currentTurn === "WHITE" ? "White to move" : "Black to move";
}

function formatHistoryEntry(move) {
    if (!move) return "";

    const player = move.piece.startsWith("WHITE") ? "White" : "Black";
    const pieceLabel = move.piece.replaceAll("_", " ").toLowerCase();
    if (move.castling === "kingside") return `${player}: castle kingside`;
    if (move.castling === "queenside") return `${player}: castle queenside`;
    if (move.enPassant) return `${player}: ${pieceLabel} ${move.from}×${move.to} (en passant)`;
    if (move.captured) return `${player}: ${pieceLabel} ${move.from}×${move.to}`;
    return `${player}: ${pieceLabel} ${move.from}→${move.to}`;
}

function appendHistoryEntry(move) {
    const historyList = document.getElementById("moveHistoryList");
    if (!historyList) return;

    const item = document.createElement("li");
    item.textContent = formatHistoryEntry(move);
    historyList.appendChild(item);
    historyList.scrollTop = historyList.scrollHeight;
}

function promotePawnIfNeeded(square) {
    if (!square || !square.piece || !square.piece.piece_name.endsWith("PAWN")) return;

    const rank = square.id[1];
    const isWhite = square.piece.piece_name.startsWith("WHITE");
    const reachedLastRank = (isWhite && rank === "8") || (!isWhite && rank === "1");
    if (!reachedLastRank) return;

    const promotedPiece = isWhite ? pieces.whiteQueen(square.id) : pieces.blackQueen(square.id);
    square.piece = promotedPiece;

    const squareEl = document.getElementById(square.id);
    if (!squareEl) return;

    const img = squareEl.querySelector("img");
    if (img) {
        img.src = promotedPiece.img;
        img.alt = promotedPiece.piece_name;
    }
}

function handlePieceSelection(piece) {
    if (gameState.gameOver || gameState.awaitingPromotion) return;
    if (piece === selfHighlightState) {
        clearPreviousSelfHighlight(selfHighlightState);
        selfHighlightState = null;
        clearHighlight();
        moveState = null;
        return;
    }

    // only allow selecting a piece of the current turn
    const color = piece.piece_name.startsWith("WHITE") ? "WHITE" : "BLACK";
    if (color !== gameState.currentTurn) return;

    // highlight selected piece and possible moves (all piece types)
    selfHighlight(piece);
    selfHighlightState = piece;
    moveState = piece;

    clearHighlight();
    const moves = getLegalMovesForPiece(globalState, piece, gameState);
    moves.forEach((id) => {
        const sq = globalState.flat().find((s) => s.id === id);
        if (sq) {
            sq.highlight(true);
            renderHighlight(sq.id);
        }
    });
}

function handleMoveTo(id, promotionChoice = null) {
    if (!moveState) return;
    const isPawnMove = moveState.piece_name.endsWith('PAWN');
    // ensure target is a highlighted legal move
    const targetSq = globalState.flat().find((s) => s.id === id);
    if (!targetSq || !targetSq.highlighted) return;
    if (gameState.gameOver) return; // block moves after game over
    if (gameState.awaitingPromotion) return; // block until promotion chosen
    pushUndoSnapshot();
    // capture board & gamestate snapshot before mutating for SAN generation
    const boardBefore = cloneBoard(globalState);
    const gameStateBefore = JSON.parse(JSON.stringify(gameState));

    const from = moveState.current_position;
    const capturedPieceName = targetSq.piece ? targetSq.piece.piece_name : null;
    let historyEntry = {
        piece: moveState.piece_name,
        from,
        to: id,
    };
    // detect castling: king move from e1/e8 to g1/c1 or g8/c8
    const isKing = moveState.piece_name.endsWith("KING");
    const castlingTargets = { 'WHITE': { kingside: 'g1', queenside: 'c1', rank: '1' }, 'BLACK': { kingside: 'g8', queenside: 'c8', rank: '8' } };
    if (isKing) {
        const color = moveState.piece_name.startsWith('WHITE') ? 'WHITE' : 'BLACK';
        const cfg = castlingTargets[color];
        // kingside
        if (id === cfg.kingside && (from === `e${cfg.rank}`)) {
            // move king
            moveElement(moveState, id);
            // move rook from h? to f?
            const rookFrom = `h${cfg.rank}`;
            const rookTo = `f${cfg.rank}`;
            const rookSq = globalState.flat().find((s) => s.id === rookFrom);
            if (rookSq && rookSq.piece) {
                const rookPiece = rookSq.piece;
                const rookPieceName = rookPiece.piece_name;
                moveElement(rookPiece, rookTo);
                // record rook move as part of castling (will be ignored in SAN rendering)
                gameState.moveHistory.push({ piece: rookPieceName, from: rookFrom, to: rookTo, partOf: 'castling' });
            }
            // record king move (mark as castling)
            gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id, castling: 'kingside' });
            gameState.lastMove = { piece: moveState.piece_name, from, to: id, castling: 'kingside' };
            historyEntry = { piece: moveState.piece_name, from, to: id, castling: 'kingside' };
        }
        // queenside
        else if (id === cfg.queenside && (from === `e${cfg.rank}`)) {
            moveElement(moveState, id);
            const rookFrom = `a${cfg.rank}`;
            const rookTo = `d${cfg.rank}`;
            const rookSq = globalState.flat().find((s) => s.id === rookFrom);
            if (rookSq && rookSq.piece) {
                const rookPiece = rookSq.piece;
                const rookPieceName = rookPiece.piece_name;
                moveElement(rookPiece, rookTo);
                gameState.moveHistory.push({ piece: rookPieceName, from: rookFrom, to: rookTo, partOf: 'castling' });
            }
            gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id, castling: 'queenside' });
            gameState.lastMove = { piece: moveState.piece_name, from, to: id, castling: 'queenside' };
            historyEntry = { piece: moveState.piece_name, from, to: id, castling: 'queenside' };
        }
        else {
            // normal king move
            moveElement(moveState, id);
            gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id });
            gameState.lastMove = { piece: moveState.piece_name, from, to: id };
        }
    } else {
        // normal non-king move
        // en-passant detection for pawn captures
        if (moveState.piece_name.endsWith('PAWN')) {
            const fromFile = from[0];
            const fromRank = Number(from[1]);
            const toFile = id[0];
            const toRank = Number(id[1]);
            // en-passant occurs when pawn moves diagonally to an empty square and lastMove was a two-square pawn move adjacent
            const targetSqEmpty = !targetSq.piece;
            const last = gameState.lastMove;
            if (fromFile !== toFile && targetSqEmpty && last && last.piece && last.piece.endsWith('PAWN') && last.to === `${toFile}${fromRank}` && Math.abs(Number(last.from[1]) - Number(last.to[1])) === 2) {
                // remove captured pawn at last.to (which is adjacent)
                const capturedPos = last.to;
                const capSq = globalState.flat().find((s) => s.id === capturedPos);
                if (capSq && capSq.piece) {
                    const capEl = document.getElementById(capturedPos);
                    const img = capEl.querySelector('img');
                    if (img) capEl.removeChild(img);
                    capSq.piece = null;
                }
                // move pawn to destination
                moveElement(moveState, id);
                gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id, enPassant: true, captured: { piece: last.piece, at: capturedPos } });
                gameState.lastMove = { piece: moveState.piece_name, from, to: id, enPassant: true, captured: { piece: last.piece, at: capturedPos } };
                historyEntry = { piece: moveState.piece_name, from, to: id, enPassant: true, captured: { piece: last.piece, at: capturedPos } };
            } else {
                moveElement(moveState, id);
                gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id });
                gameState.lastMove = { piece: moveState.piece_name, from, to: id };
                if (capturedPieceName) {
                    historyEntry = { piece: moveState.piece_name, from, to: id, captured: { piece: capturedPieceName, at: id } };
                }
            }
        } else {
            moveElement(moveState, id);
            gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id });
            gameState.lastMove = { piece: moveState.piece_name, from, to: id };
            if (capturedPieceName) {
                historyEntry = { piece: moveState.piece_name, from, to: id, captured: { piece: capturedPieceName, at: id } };
            }
        }
    }

    // promote pawns that reached the last rank
    const landedSquare = globalState.flat().find((s) => s.id === id);
    // if pawn reached last rank, open promotion chooser instead of auto-promote
    let promotionTriggered = false;
    if (landedSquare && landedSquare.piece && landedSquare.piece.piece_name.endsWith('PAWN')) {
        const isWhite = landedSquare.piece.piece_name.startsWith('WHITE');
        const rank = landedSquare.id[1];
        const reachedLast = (isWhite && rank === '8') || (!isWhite && rank === '1');
        if (reachedLast) {
            clearSelection();
            if (promotionChoice) {
                const color = isWhite ? 'WHITE' : 'BLACK';
                const pieceShort = promotionChoice; // e.g. "QUEEN"
                const newPiece = pieces.createPiece(`${color}_${pieceShort}`, landedSquare.id);
                landedSquare.piece = newPiece;
                refreshBoardUI();
                historyEntry.promotedTo = `${color}_${pieceShort}`;
                try {
                    const san = toSAN(historyEntry, boardBefore, gameStateBefore);
                    historyEntry.san = san;
                    for (let i = gameState.moveHistory.length - 1; i >= 0; i--) {
                        const m = gameState.moveHistory[i];
                        if (m.partOf === 'castling') continue;
                        if (m.from === historyEntry.from && m.to === historyEntry.to) {
                            gameState.moveHistory[i].promotedTo = `${color}_${pieceShort}`;
                            gameState.moveHistory[i].san = san;
                            break;
                        }
                    }
                } catch (e) {
                    console.error("SAN generation failed on direct promotion", e);
                }
                try {
                    const key = generatePositionKey(globalState, gameState);
                    gameState.positionHistory = gameState.positionHistory || [];
                    gameState.positionHistory.push(key);
                } catch (e) {
                    console.error("poskey regeneration failed on direct promotion", e);
                }
            } else {
                // set awaitingPromotion and render chooser
                gameState.awaitingPromotion = {
                    squareId: landedSquare.id,
                    color: isWhite ? 'WHITE' : 'BLACK',
                    historyRef: historyEntry,
                    boardBefore,
                    gameStateBefore
                };
                showPromotionModal(landedSquare.id, isWhite ? 'WHITE' : 'BLACK');
                promotionTriggered = true;
            }
        }
    }

    // store SAN for this move using board snapshot before the move
    try {
        const san = toSAN(historyEntry, boardBefore, gameStateBefore);
        historyEntry.san = san;
        // attach san to the last pushed move (the move we recorded in moveHistory)
        // find last index of a move matching piece/from/to and not partOf castling
        for (let i = gameState.moveHistory.length - 1; i >= 0; i--) {
            const m = gameState.moveHistory[i];
            if (m.partOf === 'castling') continue;
            if (m.piece === historyEntry.piece && m.from === historyEntry.from && m.to === historyEntry.to) {
                gameState.moveHistory[i].san = san;
                break;
            }
        }
    } catch (e) {
        console.error('SAN generation failed', e);
    }

    // update halfmove clock and fullmove number
    const isCapture = !!(historyEntry.captured || historyEntry.enPassant);
    if (isPawnMove || isCapture) gameState.halfmoveClock = 0; else gameState.halfmoveClock = (gameState.halfmoveClock || 0) + 1;
    const prevTurn = gameState.currentTurn;
    gameState.currentTurn = gameState.currentTurn === "WHITE" ? "BLACK" : "WHITE";
    if (prevTurn === 'BLACK') gameState.fullmoveNumber = (gameState.fullmoveNumber || 1) + 1;
    syncTurnIndicator();
    gameState.status = "ACTIVE";
    gameState.statusMessage = gameState.currentTurn === "WHITE" ? "White to move" : "Black to move";
    setStatus("ACTIVE", gameState.statusMessage, null);

    // push position key for repetition
    try {
        const key = generatePositionKey(globalState, gameState);
        gameState.positionHistory = gameState.positionHistory || [];
        gameState.positionHistory.push(key);
    } catch (e) { console.error('poskey error', e); }

    // re-render full move list
    renderMoveHistory();
    updateKingCheckHighlight();

    // if promotion is pending, wait for user choice before final checks
    if (promotionTriggered) return;

    updateTerminationStatus();
    afterMoveCompletion();

    // cleanup
    clearSelection();
    updateNavigationButtons();
}

// Promotion modal UI
function showPromotionModal(squareId, color) {
    // simple modal overlay
    const existing = document.getElementById('promotionModal');
    if (existing) existing.remove();
    const modal = document.createElement('div');
    modal.id = 'promotionModal';
    modal.style = 'position:fixed;left:0;top:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999;';
    const panel = document.createElement('div');
    panel.style = 'background:#fff;padding:16px;border-radius:8px;display:flex;gap:12px;align-items:center;box-shadow:0 6px 18px rgba(0,0,0,0.2)';
    const title = document.createElement('div');
    title.textContent = 'Choose promotion';
    title.style = 'font-weight:600;margin-right:8px;';
    panel.appendChild(title);
    const pieces = ['QUEEN', 'ROOK', 'BISHOP', 'KNIGHT'];
    pieces.forEach((p) => {
        const btn = document.createElement('button');
        btn.textContent = p[0];
        btn.style = 'min-width:44px;padding:8px;border-radius:6px;border:1px solid #ccc;background:#f8f8f8;cursor:pointer;';
        btn.addEventListener('click', () => {
            applyPromotion(squareId, color, p);
            document.body.removeChild(modal);
        });
        panel.appendChild(btn);
    });
    modal.appendChild(panel);
    document.body.appendChild(modal);
}

function applyPromotion(squareId, color, pieceShort) {
    // map to piece factory
    const sq = globalState.flat().find(s => s.id === squareId);
    if (!sq) return;
    // import pieces dynamically via existing import at top
    let newPiece = null;
    if (color === 'WHITE') {
        if (pieceShort === 'QUEEN') newPiece = pieces.whiteQueen(squareId);
        if (pieceShort === 'ROOK') newPiece = pieces.whiteRook(squareId);
        if (pieceShort === 'BISHOP') newPiece = pieces.whiteBishop(squareId);
        if (pieceShort === 'KNIGHT') newPiece = pieces.whiteKnight(squareId);
    } else {
        if (pieceShort === 'QUEEN') newPiece = pieces.blackQueen(squareId);
        if (pieceShort === 'ROOK') newPiece = pieces.blackRook(squareId);
        if (pieceShort === 'BISHOP') newPiece = pieces.blackBishop(squareId);
        if (pieceShort === 'KNIGHT') newPiece = pieces.blackKnight(squareId);
    }
    if (!newPiece) return;
    sq.piece = newPiece;
    const el = document.getElementById(squareId);
    if (el) {
        const img = el.querySelector('img');
        if (img) {
            img.src = newPiece.img;
            img.alt = newPiece.piece_name;
        } else {
            // create image
            const imgEl = document.createElement('img');
            imgEl.src = newPiece.img;
            imgEl.alt = newPiece.piece_name;
            el.appendChild(imgEl);
        }
    }

    // update move history last entry (the one awaiting promotion)
    const awaiting = gameState.awaitingPromotion;
    if (awaiting && awaiting.historyRef) {
        const historyEntry = awaiting.historyRef;
        historyEntry.promotedTo = `${color}_${pieceShort}`;
        try {
            const san = toSAN(historyEntry, awaiting.boardBefore, awaiting.gameStateBefore);
            historyEntry.san = san;
            // sync history entry san in moveHistory
            for (let i = gameState.moveHistory.length - 1; i >= 0; i--) {
                const m = gameState.moveHistory[i];
                if (m.partOf === 'castling') continue;
                if (m.from === historyEntry.from && m.to === historyEntry.to) {
                    gameState.moveHistory[i].promotedTo = `${color}_${pieceShort}`;
                    gameState.moveHistory[i].san = san;
                    break;
                }
            }
        } catch (e) {
            console.error("SAN generation failed on promotion", e);
        }
    }

    // update position key with the new promoted piece
    try {
        const key = generatePositionKey(globalState, gameState);
        if (gameState.positionHistory && gameState.positionHistory.length > 0) {
            gameState.positionHistory[gameState.positionHistory.length - 1] = key;
        } else {
            gameState.positionHistory = [key];
        }
    } catch (e) {
        console.error("poskey regeneration failed on promotion", e);
    }

    gameState.awaitingPromotion = null;
    // after promotion, continue with game over checks
    renderMoveHistory();
    updateKingCheckHighlight();
    updateTerminationStatus();
    afterMoveCompletion();
    updateNavigationButtons();
}

function restartGame() {
    clearIntervals();
    if (gameState.mode !== "ONLINE") {
        disconnectSocket();
    }
    const modal = document.getElementById("promotionModal");
    if (modal) modal.remove();
    
    const prevMode = gameState.mode;
    const timeControl = gameState.timeControl;
    const onBackToMenu = gameState.onBackToMenu;

    resetGlobalState();
    resetGameState();
    const boardRoot = document.getElementById("root");
    if (boardRoot) {
        boardRoot.innerHTML = "";
        initGameRender(globalState);
    }
    try {
        const key = generatePositionKey(globalState, gameState);
        gameState.positionHistory = [key];
    } catch (e) {
        console.error("poskey init failed on restart", e);
    }
    const historyList = document.getElementById("moveHistoryList");
    if (historyList) historyList.innerHTML = "";
    
    gameState.mode = prevMode;
    gameState.timeControl = timeControl;
    gameState.onBackToMenu = onBackToMenu;
    
    if (prevMode === "LOCAL" && timeControl) {
        gameState.clocks = { WHITE: timeControl, BLACK: timeControl };
        updateClockUI();
        startClock();
    } else {
        clearIntervals();
    }

    const turnIndicator = document.getElementById("turnIndicator");
    if (turnIndicator) turnIndicator.textContent = "White to move";
    const statusValue = document.getElementById("gameStateIndicator");
    if (statusValue) statusValue.textContent = "ACTIVE";
    const statusMessage = document.getElementById("statusMessage");
    if (statusMessage) statusMessage.textContent = "White to move";
    const winnerIndicator = document.getElementById("winnerIndicator");
    if (winnerIndicator) winnerIndicator.textContent = "-";
    const bannerEl = document.getElementById("gameBanner");
    if (bannerEl) {
        bannerEl.dataset.status = "active";
        bannerEl.textContent = "White to move";
    }
    moveState = null;
    selfHighlightState = null;
    refreshBoardUI();
    clearKingCheckHighlight();
    setStatus("ACTIVE", "White to move", null);
    syncTurnIndicator();
    updateNavigationButtons();
    
    if (gameState.mode === "ANALYSIS") {
        const fenInput = document.getElementById("fenInput");
        if (fenInput) fenInput.value = toFEN(globalState, gameState);
    }
}

function undoMove() {
    if (gameState.mode !== "ANALYSIS") return;
    if (!gameState.undoStack || gameState.undoStack.length === 0) return;
    const modal = document.getElementById("promotionModal");
    if (modal) modal.remove();

    const snapshot = gameState.undoStack.pop();
    restoreBoardSnapshot(snapshot.board);
    restoreGameStateSnapshot(snapshot.gameState);
    clearSelection();
    refreshBoardUI();
    renderMoveHistory();
    updateKingCheckHighlight();
    syncTurnIndicator();
    setStatus(gameState.status || "ACTIVE", gameState.statusMessage || (gameState.currentTurn === "WHITE" ? "White to move" : "Black to move"), gameState.winner || null);
    gameState.reviewIndex = null;
    updateNavigationButtons();
    
    const fenInput = document.getElementById("fenInput");
    if (fenInput) fenInput.value = toFEN(globalState, gameState);
}

function renderMoveHistory() {
    const historyList = document.getElementById("moveHistoryList");
    if (!historyList) return;
    historyList.innerHTML = '';
    // filter out partOf castling entries (rook moves part of castling)
    const moves = gameState.moveHistory.filter(m => !m.partOf);
    
    // Determine which move index to highlight
    let highlightIdx = -1;
    if (gameState.reviewIndex !== null) {
        highlightIdx = gameState.reviewIndex - 1;
    } else {
        highlightIdx = moves.length - 1;
    }

    for (let i = 0; i < moves.length; i += 2) {
        const white = moves[i];
        const black = moves[i + 1];
        const moveNumber = Math.floor(i / 2) + 1;
        
        // Move number column
        const numSpan = document.createElement('span');
        numSpan.className = 'history-number';
        numSpan.textContent = `${moveNumber}.`;
        historyList.appendChild(numSpan);
        
        // White move column
        const wsan = white && white.san ? white.san : (white ? (white.piece.split('_')[1][0] + ' ' + white.from + '→' + white.to) : '');
        const whiteSpan = document.createElement('span');
        whiteSpan.className = 'history-move';
        whiteSpan.textContent = wsan;
        if (i === highlightIdx) {
            whiteSpan.classList.add('active-move');
        }
        historyList.appendChild(whiteSpan);
        
        // Black move column
        if (black) {
            const bsan = black && black.san ? black.san : (black.piece.split('_')[1][0] + ' ' + black.from + '→' + black.to);
            const blackSpan = document.createElement('span');
            blackSpan.className = 'history-move';
            blackSpan.textContent = bsan;
            if (i + 1 === highlightIdx) {
                blackSpan.classList.add('active-move');
            }
            historyList.appendChild(blackSpan);
        } else {
            // Placeholder empty span to keep grid structure
            const emptySpan = document.createElement('span');
            emptySpan.className = 'history-move-empty';
            historyList.appendChild(emptySpan);
        }
    }
    
    // Auto scroll to active move within container only (prevents viewport jump on mobile)
    const activeEl = historyList.querySelector('.active-move');
    if (activeEl) {
        historyList.scrollTop = activeEl.offsetTop - historyList.offsetTop;
    } else {
        historyList.scrollTop = historyList.scrollHeight;
    }
}

function flipBoard() {
    const root = document.getElementById("root");
    if (root) {
        root.classList.toggle("flipped");
    }
}

function generatePGN() {
    const event = '[Event "Local Game"]';
    const site = '[Site "Browser Chess"]';
    
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const date = `[Date "${year}.${month}.${day}"]`;
    
    let resultStr = '*';
    if (gameState.gameOver) {
        if (gameState.winner === 'WHITE') {
            resultStr = '1-0';
        } else if (gameState.winner === 'BLACK') {
            resultStr = '0-1';
        } else {
            resultStr = '1/2-1/2';
        }
    }
    const result = `[Result "${resultStr}"]`;
    
    const moves = gameState.moveHistory.filter(m => !m.partOf);
    const pgnMoves = [];
    for (let i = 0; i < moves.length; i += 2) {
        const white = moves[i];
        const black = moves[i + 1];
        const moveNumber = Math.floor(i / 2) + 1;
        let entry = `${moveNumber}. ${white.san}`;
        if (black) {
            entry += ` ${black.san}`;
        }
        pgnMoves.push(entry);
    }
    
    const movesText = pgnMoves.join(' ') + (pgnMoves.length > 0 ? ' ' : '') + resultStr;
    
    return `${event}\n${site}\n${date}\n${result}\n\n${movesText}\n`;
}

function downloadPGN() {
    const pgn = generatePGN();
    if (typeof Blob === 'undefined' || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
        console.log("PGN Export (Console fall-back):\n", pgn);
        return;
    }
    const blob = new Blob([pgn], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chess_game_${new Date().toISOString().slice(0, 10).replace(/-/g, '_')}.pgn`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function updateNavigationButtons() {
    const N = gameState.undoStack ? gameState.undoStack.length : 0;
    const btnFirst = document.querySelector('[data-action="nav-first"]');
    const btnPrev = document.querySelector('[data-action="nav-prev"]');
    const btnNext = document.querySelector('[data-action="nav-next"]');
    const btnLast = document.querySelector('[data-action="nav-last"]');
    
    if (N === 0) {
        if (btnFirst) btnFirst.disabled = true;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        if (btnLast) btnLast.disabled = true;
        return;
    }
    
    if (gameState.reviewIndex === 0) {
        if (btnFirst) btnFirst.disabled = true;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = false;
        if (btnLast) btnLast.disabled = false;
    } else if (gameState.reviewIndex === null) {
        if (btnFirst) btnFirst.disabled = false;
        if (btnPrev) btnPrev.disabled = false;
        if (btnNext) btnNext.disabled = true;
        if (btnLast) btnLast.disabled = true;
    } else {
        if (btnFirst) btnFirst.disabled = false;
        if (btnPrev) btnPrev.disabled = false;
        if (btnNext) btnNext.disabled = false;
        if (btnLast) btnLast.disabled = false;
    }
}

function handleNavigation(action) {
    if (gameState.mode !== "ANALYSIS") return;
    const N = gameState.undoStack ? gameState.undoStack.length : 0;
    if (N === 0) return;
    
    if (action === "nav-first") {
        gameState.reviewIndex = 0;
    } else if (action === "nav-prev") {
        if (gameState.reviewIndex === null) {
            gameState.reviewIndex = N - 1;
        } else if (gameState.reviewIndex > 0) {
            gameState.reviewIndex--;
        }
    } else if (action === "nav-next") {
        if (gameState.reviewIndex !== null) {
            if (gameState.reviewIndex < N - 1) {
                gameState.reviewIndex++;
            } else {
                gameState.reviewIndex = null;
            }
        }
    } else if (action === "nav-last") {
        gameState.reviewIndex = null;
    }
    
    updateReviewUI();
}

function updateReviewUI() {
    clearSelection();
    
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('highlightLastMove');
        sq.classList.remove('checkKing');
    });
    
    const N = gameState.undoStack ? gameState.undoStack.length : 0;
    
    if (gameState.reviewIndex === null) {
        refreshBoardUI();
        updateKingCheckHighlight();
        syncTurnIndicator();
        setStatus(gameState.status || "ACTIVE", gameState.statusMessage || (gameState.currentTurn === "WHITE" ? "White to move" : "Black to move"), gameState.winner || null);
    } else {
        const k = gameState.reviewIndex;
        const snapshot = gameState.undoStack[k];
        
        refreshBoardUIFromBoard(snapshot.board);
        
        if (k > 0) {
            const lastMove = gameState.moveHistory[k - 1];
            if (lastMove) {
                document.getElementById(lastMove.from)?.classList.add('highlightLastMove');
                document.getElementById(lastMove.to)?.classList.add('highlightLastMove');
            }
        }
        
        const reviewState = snapshot.gameState;
        if (reviewState.status === 'CHECK' || reviewState.status === 'CHECKMATE') {
            const kingColor = reviewState.currentTurn;
            const kingPieceName = kingColor === 'WHITE' ? 'WHITE_KING' : 'BLACK_KING';
            const kingSquare = snapshot.board.flat().find(s => s.piece && s.piece.piece_name === kingPieceName);
            if (kingSquare) {
                document.getElementById(kingSquare.id)?.classList.add('checkKing');
            }
        }
        
        const turnIndicator = document.getElementById("turnIndicator");
        if (turnIndicator) turnIndicator.textContent = "Review Mode";
        
        const stateIndicator = document.getElementById("gameStateIndicator");
        if (stateIndicator) stateIndicator.textContent = "REVIEW";
        
        const statusMessage = document.getElementById("statusMessage");
        if (statusMessage) {
            if (k === 0) {
                statusMessage.textContent = "Starting position";
            } else {
                statusMessage.textContent = `Showing move ${k} of ${N}: ${gameState.moveHistory[k - 1].san}`;
            }
        }
        
        const bannerEl = document.getElementById("gameBanner");
        if (bannerEl) {
            bannerEl.dataset.status = "review";
            if (k === 0) {
                bannerEl.textContent = "Review Mode: Starting position";
            } else {
                bannerEl.textContent = `Review Mode: Move ${k} (${gameState.moveHistory[k - 1].san})`;
            }
        }
    }
    
    renderMoveHistory();
    updateNavigationButtons();
}

function GlobalEvent() {
    syncTurnIndicator();
    try {
        const key = generatePositionKey(globalState, gameState);
        gameState.positionHistory = [key];
    } catch (e) {
        console.error("poskey init failed", e);
    }
    updateNavigationButtons();
    const controls = document.getElementById("gameControls");
    if (controls) {
        controls.addEventListener("click", function (event) {
            const action = event.target && event.target.dataset ? event.target.dataset.action : null;
            if (action === "restart") restartGame();
            if (action === "undo") undoMove();
            if (action === "flip") flipBoard();
            if (action === "export-pgn") downloadPGN();
            if (action === "new-game") {
                if (gameState.onBackToMenu) gameState.onBackToMenu();
            }
        });
    }
    const nav = document.getElementById("gameNavigation");
    if (nav) {
        nav.addEventListener("click", function (event) {
            const action = event.target && event.target.dataset ? event.target.dataset.action : null;
            if (action && action.startsWith("nav-")) {
                handleNavigation(action);
            }
        });
    }
    
    // Global delegation for dynamic mode buttons (FEN, menu back buttons)
    if (!GlobalEvent._delegatedAdded) {
        document.body.addEventListener("click", function (event) {
            const action = event.target && event.target.dataset ? event.target.dataset.action : null;
            if (action === "load-fen") {
                const val = document.getElementById("fenInput")?.value;
                if (val) loadFEN(val);
            }
            if (action === "copy-fen") {
                copyFENToClipboard();
            }
            if (action === "back-to-menu") {
                disconnectSocket();
                if (gameState.onBackToMenu) gameState.onBackToMenu();
            }
            if (action === "online-resign") {
                if (socket && gameState.roomId) {
                    if (confirm("Are you sure you want to resign?")) {
                        socket.emit("resign", { roomId: gameState.roomId });
                    }
                }
            }
        });
        GlobalEvent._delegatedAdded = true;
    }

    ROOT_DIV.addEventListener("click", function (event) {
        if (gameState.reviewIndex !== null) {
            return;
        }
        if (gameState.mode === "ONLINE") {
            if (gameState.onlineStatus !== "CONNECTED") return;
            if (gameState.currentTurn !== gameState.playerColor) return;
        }
        // if clicked on a piece image
        if (event.target.localName === "img") {
            const clickedId = event.target.parentNode.id;
            const square = globalState.flat().find((el) => el.id === clickedId);
            if (!square || !square.piece) return;

            // if a piece is already selected and the clicked piece sits on a legal target square,
            // treat this as a capture/move instead of a new selection
            if (moveState && square.highlighted) {
                handleMoveTo(clickedId);
                return;
            }

            // only allow selecting a piece of the current turn
            const color = square.piece.piece_name.startsWith("WHITE") ? "WHITE" : "BLACK";
            if (color !== gameState.currentTurn) return;

            handlePieceSelection(square.piece);
            return;
        }

        // clicked on a square / highlight
        const target = event.target;
        let id = null;
        if (target.localName === "span") {
            id = target.parentNode.id;
        } else if (target.id) {
            id = target.id;
        }

        if (id) {
            handleMoveTo(id);
        } else {
            // clicked elsewhere: clear selection
            clearSelection();
        }
    });
}

export let socket = null;

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    gameState.roomId = null;
    gameState.playerColor = null;
    gameState.onlineStatus = null;
    const onlineCard = document.getElementById("onlineCard");
    if (onlineCard) {
        onlineCard.innerHTML = "";
        onlineCard.classList.add("hidden");
    }
}

export function updateOnlineUI() {
    const onlineCard = document.getElementById("onlineCard");
    if (!onlineCard) return;

    if (gameState.onlineStatus === "WAITING") {
        onlineCard.innerHTML = `
            <div class="statusCard onlineStatusCard">
                <div class="statusLabel">Online Room</div>
                <div class="onlineRoomCode">${gameState.roomId}</div>
                <p class="onlineInstruction">Share this code with your opponent to start the match.</p>
                <div class="onlineLoader">
                    <div class="loaderCircle"></div>
                    <span>Waiting for opponent...</span>
                </div>
                <button type="button" class="menuButton secondaryButton" data-action="back-to-menu" style="margin-top: 16px;">Cancel Room</button>
            </div>
        `;
    } else if (gameState.onlineStatus === "CONNECTED") {
        const colorLabel = gameState.playerColor === "WHITE" ? "White" : "Black";
        onlineCard.innerHTML = `
            <div class="statusCard onlineStatusCard">
                <div class="statusLabel">Room Code</div>
                <div class="onlineRoomCode active">${gameState.roomId}</div>
                <div class="onlineConnectionDetails">
                    <div class="detailRow">
                        <span class="detailLabel">Your Color:</span>
                        <span class="detailValue colorBadge ${gameState.playerColor.toLowerCase()}">${colorLabel}</span>
                    </div>
                    <div class="detailRow">
                        <span class="detailLabel">Status:</span>
                        <span class="detailValue connected text-green">Connected</span>
                    </div>
                </div>
                <button type="button" class="controlButton resignButton" data-action="online-resign" style="margin-top: 16px; width: 100%;">Resign Game</button>
            </div>
        `;
    } else {
        onlineCard.innerHTML = `
            <div class="statusCard onlineStatusCard">
                <div class="statusLabel">Online Chess</div>
                <p class="onlineStatusText">Not connected to any room.</p>
                <button type="button" class="menuButton secondaryButton" data-action="back-to-menu" style="margin-top: 16px; width: 100%;">Back to Menu</button>
            </div>
        `;
    }
}

export function connectSocket() {
    if (typeof io === "undefined") {
        console.warn("Socket.io client is not loaded");
        return;
    }
    if (!socket) {
        socket = io();

        socket.on('roomCreated', ({ roomId, playerColor, timeControl }) => {
            gameState.roomId = roomId;
            gameState.playerColor = playerColor;
            gameState.timeControl = timeControl;
            gameState.clocks = { WHITE: timeControl, BLACK: timeControl };
            gameState.onlineStatus = "WAITING";
            updateOnlineUI();
        });

        socket.on('gameStart', ({ roomId, playerColors, timeControl, clocks }) => {
            gameState.roomId = roomId;
            gameState.timeControl = timeControl;
            gameState.clocks = clocks;
            gameState.onlineStatus = "CONNECTED";
            gameState.status = "ACTIVE";
            gameState.gameOver = false;
            gameState.statusMessage = "Match started!";

            const myId = socket.id;
            gameState.playerColor = playerColors.WHITE === myId ? "WHITE" : "BLACK";

            if (gameState.playerColor === "BLACK") {
                const rootDiv = document.getElementById("root");
                if (rootDiv && !rootDiv.classList.contains("flipped")) {
                    rootDiv.classList.add("flipped");
                }
            } else {
                const rootDiv = document.getElementById("root");
                if (rootDiv && rootDiv.classList.contains("flipped")) {
                    rootDiv.classList.remove("flipped");
                }
            }

            try {
                const key = generatePositionKey(globalState, gameState);
                gameState.positionHistory = [key];
            } catch (e) {
                console.error("poskey init failed", e);
            }

            updateOnlineUI();
            startClock();
            refreshBoardUI();
            syncTurnIndicator();
        });

        socket.on('opponentMoved', ({ from, to, promotion, san, clocks }) => {
            const fromSq = globalState.flat().find(s => s.id === from);
            if (!fromSq || !fromSq.piece) return;

            moveState = fromSq.piece;
            fromSq.highlighted = true;

            const targetSq = globalState.flat().find(s => s.id === to);
            if (targetSq) {
                targetSq.highlighted = true;
            }

            handleMoveTo(to, promotion);

            if (gameState.moveHistory.length > 0) {
                gameState.moveHistory[gameState.moveHistory.length - 1].opponentSync = true;
            }

            if (clocks) {
                gameState.clocks = clocks;
                updateClockUI();
            }
        });

        socket.on('gameOver', ({ winner, reason }) => {
            clearIntervals();
            gameState.gameOver = true;
            gameState.winner = winner;
            const reasonText = reason === "timeout" ? "wins on time" : "wins by resignation";
            const winnerText = winner === "WHITE" ? "White" : "Black";
            gameState.status = "GAMEOVER";
            gameState.statusMessage = `Game Over: ${winnerText} ${reasonText}`;
            setStatus("GAMEOVER", gameState.statusMessage, winner);

            const bannerEl = document.getElementById("gameBanner");
            if (bannerEl) {
                bannerEl.dataset.status = "gameover";
                bannerEl.textContent = gameState.statusMessage;
            }
        });

        socket.on('opponentDisconnected', ({ winner }) => {
            clearIntervals();
            gameState.gameOver = true;
            gameState.winner = winner;
            gameState.status = "GAMEOVER";
            gameState.statusMessage = `Game Over: Opponent disconnected. ${winner === "WHITE" ? "White" : "Black"} wins.`;
            setStatus("GAMEOVER", gameState.statusMessage, winner);

            const bannerEl = document.getElementById("gameBanner");
            if (bannerEl) {
                bannerEl.dataset.status = "gameover";
                bannerEl.textContent = gameState.statusMessage;
            }
            gameState.onlineStatus = "DISCONNECTED";
            updateOnlineUI();
        });

        socket.on('errorMsg', (msg) => {
            alert("Matchmaking Error: " + msg);
            disconnectSocket();
            if (gameState.onBackToMenu) gameState.onBackToMenu();
        });
    }
}

export { GlobalEvent, restartGame, undoMove, renderMoveHistory, syncTurnIndicator, setStatus, handleMoveTo };