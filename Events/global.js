import { ROOT_DIV } from "../Helper/constants.js";
import { globalState, gameState } from "../Data/state.js";
import { renderHighlight, clearHighlight, selfHighlight, clearPreviousSelfHighlight, moveElement } from "../Render/main.js";
import { getLegalMovesForPiece } from "../Data/engine.js";
import * as pieces from "../Data/pieces.js";

let selfHighlightState = null;
let moveState = null;

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
                // record rook move
                gameState.moveHistory.push({ piece: rookSq.piece.piece_name, from: rookFrom, to: rookTo });
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
                gameState.moveHistory.push({ piece: rookSq.piece.piece_name, from: rookFrom, to: rookTo });
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
    promotePawnIfNeeded(landedSquare);

    // toggle turn once
    gameState.currentTurn = gameState.currentTurn === "WHITE" ? "BLACK" : "WHITE";
    syncTurnIndicator();
    appendHistoryEntry(historyEntry);

    // cleanup
    clearHighlight();
    clearPreviousSelfHighlight(selfHighlightState);
    selfHighlightState = null;
    moveState = null;
}

function GlobalEvent() {
    syncTurnIndicator();
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
            clearHighlight();
            clearPreviousSelfHighlight(selfHighlightState);
            selfHighlightState = null;
            moveState = null;
        }
    });
}

export { GlobalEvent };