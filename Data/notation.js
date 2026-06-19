import { getLegalMovesForPiece, cloneBoard, applyMoveOnBoard, isKingInCheck, getSquare } from './engine.js';
import * as pieces from './pieces.js';

function pieceLetter(pieceName) {
    if (!pieceName) return '';
    if (pieceName.endsWith('PAWN')) return '';
    if (pieceName.endsWith('KNIGHT')) return 'N';
    if (pieceName.endsWith('BISHOP')) return 'B';
    if (pieceName.endsWith('ROOK')) return 'R';
    if (pieceName.endsWith('QUEEN')) return 'Q';
    if (pieceName.endsWith('KING')) return 'K';
    return '';
}

function colorOf(pieceName) {
    return pieceName && pieceName.startsWith('WHITE') ? 'WHITE' : 'BLACK';
}

function fileOf(square) { return square[0]; }
function rankOf(square) { return square[1]; }

function disambiguation(move, boardBefore, gameStateBefore) {
    // For piece moves (not pawns), if other same-type pieces of same color can move to the destination,
    // add minimal disambiguation (file, rank or full square)
    const pieceName = move.piece;
    if (!pieceName || pieceName.endsWith('PAWN')) return '';
    const from = move.from;
    const to = move.to;
    const flat = boardBefore.flat();
    const candidates = [];
    for (const s of flat) {
        if (!s.piece) continue;
        if (s.id === from) continue;
        if (s.piece.piece_name !== pieceName) continue;
        const legal = getLegalMovesForPiece(boardBefore, s.piece, gameStateBefore);
        if (legal.includes(to)) candidates.push(s.id);
    }
    if (candidates.length === 0) return '';
    // try file
    const sameFile = candidates.every((c) => fileOf(c) === fileOf(from));
    const sameRank = candidates.every((c) => rankOf(c) === rankOf(from));
    // If no other shares file, use file; else if no other shares rank, use rank; else use full
    const files = candidates.map(c => fileOf(c));
    if (!files.includes(fileOf(from))) return fileOf(from);
    const ranks = candidates.map(c => rankOf(c));
    if (!ranks.includes(rankOf(from))) return rankOf(from);
    return from; // full square
}

function simulateMoveAndCheck(move, boardBefore, gameStateBefore) {
    const cloned = cloneBoard(boardBefore);
    // apply the move
    applyMoveOnBoard(cloned, move.from, move.to, gameStateBefore);
    // handle en-passant removal
    if (move.enPassant && move.captured && move.captured.at) {
        const cap = cloned.flat().find(s => s.id === move.captured.at);
        if (cap) cap.piece = null;
    }
    // handle castling rook move
    if (move.castling) {
        const color = move.piece.startsWith('WHITE') ? 'WHITE' : 'BLACK';
        const rank = color === 'WHITE' ? '1' : '8';
        if (move.castling === 'kingside') {
            const rookFrom = `h${rank}`;
            const rookTo = `f${rank}`;
            applyMoveOnBoard(cloned, rookFrom, rookTo, gameStateBefore);
        } else if (move.castling === 'queenside') {
            const rookFrom = `a${rank}`;
            const rookTo = `d${rank}`;
            applyMoveOnBoard(cloned, rookFrom, rookTo, gameStateBefore);
        }
    }
    // handle promotion in simulation
    if (move.piece && move.piece.endsWith('PAWN')) {
        const promoRank = move.to[1];
        const isWhite = move.piece.startsWith('WHITE');
        if ((isWhite && promoRank === '8') || (!isWhite && promoRank === '1')) {
            const targetSq = cloned.flat().find(s => s.id === move.to);
            if (targetSq && targetSq.piece) {
                const color = isWhite ? 'WHITE' : 'BLACK';
                const promoType = move.promotedTo ? move.promotedTo.split('_')[1] : 'QUEEN';
                let newPiece = null;
                if (color === 'WHITE') {
                    if (promoType === 'QUEEN') newPiece = pieces.whiteQueen(move.to);
                    if (promoType === 'ROOK') newPiece = pieces.whiteRook(move.to);
                    if (promoType === 'BISHOP') newPiece = pieces.whiteBishop(move.to);
                    if (promoType === 'KNIGHT') newPiece = pieces.whiteKnight(move.to);
                } else {
                    if (promoType === 'QUEEN') newPiece = pieces.blackQueen(move.to);
                    if (promoType === 'ROOK') newPiece = pieces.blackRook(move.to);
                    if (promoType === 'BISHOP') newPiece = pieces.blackBishop(move.to);
                    if (promoType === 'KNIGHT') newPiece = pieces.blackKnight(move.to);
                }
                if (newPiece) targetSq.piece = newPiece;
            }
        }
    }
    const opponent = colorOf(move.piece) === 'WHITE' ? 'BLACK' : 'WHITE';
    const check = isKingInCheck(cloned, opponent);
    // detect if opponent has any legal moves -> mate
    let hasAny = false;
    for (const s of cloned.flat()) {
        if (!s.piece) continue;
        const c = s.piece.piece_name.startsWith('WHITE') ? 'WHITE' : 'BLACK';
        if (c !== opponent) continue;
        const legal = getLegalMovesForPiece(cloned, s.piece, gameStateBefore);
        if (legal.length > 0) { hasAny = true; break; }
    }
    return { check, mate: check && !hasAny };
}

function toSAN(move, boardBefore, gameStateBefore) {
    if (!move) return '';
    // castling
    if (move.castling === 'kingside') {
        const { check, mate } = simulateMoveAndCheck(move, boardBefore, gameStateBefore);
        return `O-O${mate ? '#' : check ? '+' : ''}`;
    }
    if (move.castling === 'queenside') {
        const { check, mate } = simulateMoveAndCheck(move, boardBefore, gameStateBefore);
        return `O-O-O${mate ? '#' : check ? '+' : ''}`;
    }

    const pLetter = pieceLetter(move.piece);
    const isPawn = move.piece && move.piece.endsWith('PAWN');
    const capture = !!(move.captured || move.enPassant);
    let san = '';

    if (isPawn) {
        if (capture) {
            san = `${fileOf(move.from)}x${move.to}`;
        } else {
            san = `${move.to}`;
        }
        // promotion
        const promoRank = move.to[1];
        if ((move.piece && move.piece.startsWith('WHITE') && promoRank === '8') || (move.piece && move.piece.startsWith('BLACK') && promoRank === '1')) {
            const letter = move.promotedTo ? pieceLetter(move.promotedTo) : 'Q';
            san += `=${letter}`;
        }
    } else {
        const dis = disambiguation(move, boardBefore, gameStateBefore);
        san = `${pLetter}${dis}${capture ? 'x' : ''}${move.to}`;
    }

    const { check, mate } = simulateMoveAndCheck(move, boardBefore, gameStateBefore);
    if (mate) san += '#';
    else if (check) san += '+';
    return san;
}

export { toSAN };
