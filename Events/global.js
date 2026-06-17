import { ROOT_DIV } from "../Helper/constants.js";
import { globalState, gameState, resetGlobalState, resetGameState, restoreBoardSnapshot, restoreGameStateSnapshot } from "../Data/state.js";
import { renderHighlight, clearHighlight, selfHighlight, clearPreviousSelfHighlight, moveElement } from "../Render/main.js";
import { getLegalMovesForPiece, cloneBoard, isKingInCheck } from "../Data/engine.js";
import { toSAN } from "../Data/notation.js";
import { hasAnyLegalMoves, generatePositionKey, insufficientMaterial } from "../Data/engine.js";
import { initGameRender } from "../Render/main.js";
import * as pieces from "../Data/pieces.js";

let selfHighlightState = null;
let moveState = null;

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
    gameState.gameOver = status !== "ACTIVE";
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

function refreshBoardUI() {
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

function handleMoveTo(id) {
    if (!moveState) return;
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
                moveElement(rookSq.piece, rookTo);
                // record rook move as part of castling (will be ignored in SAN rendering)
                gameState.moveHistory.push({ piece: rookSq.piece.piece_name, from: rookFrom, to: rookTo, partOf: 'castling' });
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
                moveElement(rookSq.piece, rookTo);
                gameState.moveHistory.push({ piece: rookSq.piece.piece_name, from: rookFrom, to: rookTo, partOf: 'castling' });
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
            // set awaitingPromotion and render chooser
            gameState.awaitingPromotion = { squareId: landedSquare.id, color: isWhite ? 'WHITE' : 'BLACK', historyRef: historyEntry };
            showPromotionModal(landedSquare.id, isWhite ? 'WHITE' : 'BLACK');
            promotionTriggered = true;
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
    const isPawnMove = moveState.piece_name.endsWith('PAWN');
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

    // cleanup
    clearSelection();
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
        // find last matching move
        for (let i = gameState.moveHistory.length - 1; i >= 0; i--) {
            const m = gameState.moveHistory[i];
            if (m.from === awaiting.historyRef.from && m.to === awaiting.historyRef.to && m.piece === awaiting.historyRef.piece) {
                gameState.moveHistory[i].promotedTo = `${color}_${pieceShort}`;
                // adjust SAN if present by replacing =Q with =<letter>
                if (gameState.moveHistory[i].san) {
                    const letter = pieceShort[0];
                    gameState.moveHistory[i].san = gameState.moveHistory[i].san.replace('=Q', `=${letter}`);
                }
                break;
            }
        }
    }

    gameState.awaitingPromotion = null;
    // after promotion, continue with game over checks
    renderMoveHistory();
    updateKingCheckHighlight();
    updateTerminationStatus();
}

function restartGame() {
    resetGlobalState();
    resetGameState();
    const boardRoot = document.getElementById("root");
    if (boardRoot) {
        boardRoot.innerHTML = "";
        initGameRender(globalState);
    }
    const historyList = document.getElementById("moveHistoryList");
    if (historyList) historyList.innerHTML = "";
    const turnIndicator = document.getElementById("turnIndicator");
    if (turnIndicator) turnIndicator.textContent = "White to move";
    const statusValue = document.getElementById("gameStateIndicator");
    if (statusValue) statusValue.textContent = "ACTIVE";
    const statusMessage = document.getElementById("statusMessage");
    if (statusMessage) statusMessage.textContent = "White to move";
    const winnerIndicator = document.getElementById("winnerIndicator");
    if (winnerIndicator) winnerIndicator.textContent = "-";
    moveState = null;
    selfHighlightState = null;
    refreshBoardUI();
    clearKingCheckHighlight();
    setStatus("ACTIVE", "White to move", null);
    syncTurnIndicator();
}

function undoMove() {
    if (!gameState.undoStack || gameState.undoStack.length === 0) return;
    const snapshot = gameState.undoStack.pop();
    restoreBoardSnapshot(snapshot.board);
    restoreGameStateSnapshot(snapshot.gameState);
    clearSelection();
    refreshBoardUI();
    renderMoveHistory();
    updateKingCheckHighlight();
    syncTurnIndicator();
    setStatus(gameState.status || "ACTIVE", gameState.statusMessage || (gameState.currentTurn === "WHITE" ? "White to move" : "Black to move"), gameState.winner || null);
}

function renderMoveHistory() {
    const historyList = document.getElementById("moveHistoryList");
    if (!historyList) return;
    historyList.innerHTML = '';
    // filter out partOf castling entries (rook moves part of castling)
    const moves = gameState.moveHistory.filter(m => !m.partOf);
    for (let i = 0; i < moves.length; i += 2) {
        const white = moves[i];
        const black = moves[i + 1];
        const moveNumber = Math.floor(i / 2) + 1;
        const wsan = white && white.san ? white.san : (white ? (white.piece + ' ' + white.from + '→' + white.to) : '');
        const bsan = black && black.san ? black.san : (black ? (black.piece + ' ' + black.from + '→' + black.to) : '');
        const item = document.createElement('li');
        item.textContent = `${moveNumber}. ${wsan}${bsan ? ' ' + bsan : ''}`;
        historyList.appendChild(item);
    }
    historyList.scrollTop = historyList.scrollHeight;
}

function GlobalEvent() {
    syncTurnIndicator();
    const controls = document.getElementById("gameControls");
    if (controls) {
        controls.addEventListener("click", function (event) {
            const action = event.target && event.target.dataset ? event.target.dataset.action : null;
            if (action === "restart") restartGame();
            if (action === "undo") undoMove();
        });
    }
    ROOT_DIV.addEventListener("click", function (event) {
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

export { GlobalEvent, restartGame, undoMove, renderMoveHistory, syncTurnIndicator, setStatus };