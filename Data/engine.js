// Move-generation engine (scaffold).
// Implements pawn, rook, bishop, knight, queen, king basic moves.

function flatten(board) {
    return board.flat();
}

function getSquare(board, id) {
    return flatten(board).find((s) => s.id === id);
}

function isEmpty(board, id) {
    const sq = getSquare(board, id);
    return sq && !sq.piece;
}

function isEnemy(board, id, color) {
    const sq = getSquare(board, id);
    if (!sq || !sq.piece) return false;
    return (color === "WHITE") ? sq.piece.piece_name.startsWith("BLACK") : sq.piece.piece_name.startsWith("WHITE");
}

function getPawnMoves(board, piece, gameState) {
    // piece.current_position like 'e2'
    const moves = [];
    const file = piece.current_position[0];
    const rank = Number(piece.current_position[1]);
    const color = piece.piece_name.startsWith("WHITE") ? "WHITE" : "BLACK";

    if (color === "WHITE") {
        const one = `${file}${rank + 1}`;
        if (isEmpty(board, one)) moves.push(one);

        // two-square from starting rank
        if (rank === 2) {
            const two = `${file}${rank + 2}`;
            if (isEmpty(board, one) && isEmpty(board, two)) moves.push(two);
        }

        // captures
        const left = `${String.fromCharCode(file.charCodeAt(0) - 1)}${rank + 1}`;
        const right = `${String.fromCharCode(file.charCodeAt(0) + 1)}${rank + 1}`;
        if (isEnemy(board, left, color)) moves.push(left);
        if (isEnemy(board, right, color)) moves.push(right);
        // en-passant: can capture pawn that moved two squares last move
        if (gameState && gameState.lastMove && gameState.lastMove.piece && gameState.lastMove.piece.endsWith('PAWN')) {
            const last = gameState.lastMove;
            // last pawn must have landed adjacent on same rank as this pawn
            if (last.to && /^[a-h][1-8]$/.test(last.to)) {
                const lastFile = last.to[0];
                const lastRank = Number(last.to[1]);
                // last move must be a two-square pawn move
                if (Math.abs(Number(last.from[1]) - Number(last.to[1])) === 2) {
                    // if last pawn is on left or right and same rank as this pawn
                    if (lastRank === rank && (lastFile === String.fromCharCode(file.charCodeAt(0) - 1) || lastFile === String.fromCharCode(file.charCodeAt(0) + 1))) {
                        // en-passant capture lands on the square behind the pawn
                        const epCapture = `${lastFile}${rank + 1}`;
                        if (/^[a-h][1-8]$/.test(epCapture)) moves.push(epCapture);
                    }
                }
            }
        }
    } else {
        // black
        const one = `${file}${rank - 1}`;
        if (isEmpty(board, one)) moves.push(one);

        if (rank === 7) {
            const two = `${file}${rank - 2}`;
            if (isEmpty(board, one) && isEmpty(board, two)) moves.push(two);
        }

        const left = `${String.fromCharCode(file.charCodeAt(0) - 1)}${rank - 1}`;
        const right = `${String.fromCharCode(file.charCodeAt(0) + 1)}${rank - 1}`;
        if (isEnemy(board, left, color)) moves.push(left);
        if (isEnemy(board, right, color)) moves.push(right);
        // en-passant for black
        if (gameState && gameState.lastMove && gameState.lastMove.piece && gameState.lastMove.piece.endsWith('PAWN')) {
            const last = gameState.lastMove;
            if (last.to && /^[a-h][1-8]$/.test(last.to)) {
                const lastFile = last.to[0];
                const lastRank = Number(last.to[1]);
                if (Math.abs(Number(last.from[1]) - Number(last.to[1])) === 2) {
                    if (lastRank === rank && (lastFile === String.fromCharCode(file.charCodeAt(0) - 1) || lastFile === String.fromCharCode(file.charCodeAt(0) + 1))) {
                        const epCapture = `${lastFile}${rank - 1}`;
                        if (/^[a-h][1-8]$/.test(epCapture)) moves.push(epCapture);
                    }
                }
            }
        }
    }

    // filter out invalid board coordinates (e.g., file beyond 'a'-'h' or rank out of 1-8)
    return moves.filter((id) => /^[a-h][1-8]$/.test(id));
}

function rayMoves(board, piece, deltas) {
    // deltas: array of [df, dr] where df/dr are file/rank offsets
    // used for sliding pieces (rook, bishop, queen)
    const moves = [];
    const file = piece.current_position[0];
    const rank = Number(piece.current_position[1]);
    const color = piece.piece_name.startsWith("WHITE") ? "WHITE" : "BLACK";

    deltas.forEach(([df, dr]) => {
        let f = file.charCodeAt(0) + df;
        let r = rank + dr;
        while (f >= 97 && f <= 104 && r >= 1 && r <= 8) {
            const id = `${String.fromCharCode(f)}${r}`;
            if (isEmpty(board, id)) {
                moves.push(id);
            } else {
                if (isEnemy(board, id, color)) moves.push(id);
                break; // blocked
            }
            f += df;
            r += dr;
        }
    });

    return moves;
}

function getRookMoves(board, piece) {
    return rayMoves(board, piece, [[1, 0], [-1, 0], [0, 1], [0, -1]]);
}

function getBishopMoves(board, piece) {
    return rayMoves(board, piece, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
}

function getQueenMoves(board, piece) {
    return rayMoves(board, piece, [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
}

function getKnightMoves(board, piece) {
    const moves = [];
    const file = piece.current_position[0].charCodeAt(0);
    const rank = Number(piece.current_position[1]);
    const color = piece.piece_name.startsWith("WHITE") ? "WHITE" : "BLACK";
    const deltas = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
    deltas.forEach(([df, dr]) => {
        const f = file + df;
        const r = rank + dr;
        const id = `${String.fromCharCode(f)}${r}`;
        if (/^[a-h][1-8]$/.test(id)) {
            if (isEmpty(board, id) || isEnemy(board, id, color)) moves.push(id);
        }
    });
    return moves;
}

function getKingMoves(board, piece) {
    const moves = [];
    const file = piece.current_position[0].charCodeAt(0);
    const rank = Number(piece.current_position[1]);
    const color = piece.piece_name.startsWith("WHITE") ? "WHITE" : "BLACK";
    for (let df = -1; df <= 1; df++) {
        for (let dr = -1; dr <= 1; dr++) {
            if (df === 0 && dr === 0) continue;
            const f = file + df;
            const r = rank + dr;
            const id = `${String.fromCharCode(f)}${r}`;
            if (/^[a-h][1-8]$/.test(id)) {
                if (isEmpty(board, id) || isEnemy(board, id, color)) moves.push(id);
            }
        }
    }
    // Note: castling not implemented here.
    return moves;
}

function getMovesForPiece(board, piece, gameState) {
    if (!piece) return [];
    const name = piece.piece_name;
    if (name.endsWith("PAWN")) return getPawnMoves(board, piece, gameState);
    if (name.endsWith("ROOK")) return getRookMoves(board, piece);
    if (name.endsWith("BISHOP")) return getBishopMoves(board, piece);
    if (name.endsWith("KNIGHT")) return getKnightMoves(board, piece);
    if (name.endsWith("QUEEN")) return getQueenMoves(board, piece);
    if (name.endsWith("KING")) return getKingMoves(board, piece);
    return [];
}

function cloneBoard(board) {
    // deep clone minimal structure for simulation (functions will be lost)
    return JSON.parse(JSON.stringify(board));
}

function applyMoveOnBoard(board, fromId, toId, gameState) {
    // mutate board in place; board should be a cloned board for simulation
    const flat = board.flat();
    const from = flat.find((s) => s.id === fromId);
    const to = flat.find((s) => s.id === toId);
    if (!from) return board;
    const movingPiece = from.piece;
    if (!movingPiece) return board;
    // move piece object; ensure current_position updated
    movingPiece.current_position = toId;
    to.piece = movingPiece;
    from.piece = null;
    return board;
}

function findKingPosition(board, color) {
    const flat = board.flat();
    const target = flat.find((s) => s.piece && s.piece.piece_name === (color === 'WHITE' ? 'WHITE_KING' : 'BLACK_KING'));
    return target ? target.id : null;
}

function isSquareAttacked(board, squareId, byColor) {
    // any piece of byColor can move to squareId according to basic moves
    const flat = board.flat();
    for (const s of flat) {
        if (!s.piece) continue;
        const pieceColor = s.piece.piece_name.startsWith('WHITE') ? 'WHITE' : 'BLACK';
        if (pieceColor !== byColor) continue;
        const moves = getMovesForPiece(board, s.piece);
        if (moves.includes(squareId)) return true;
    }
    return false;
}

function isKingInCheck(board, color) {
    const kingPos = findKingPosition(board, color);
    if (!kingPos) return false;
    const opponent = color === 'WHITE' ? 'BLACK' : 'WHITE';
    return isSquareAttacked(board, kingPos, opponent);
}

function getLegalMovesForPiece(board, piece, gameState) {
    const candidates = getMovesForPiece(board, piece);
    const legal = [];
    for (const to of candidates) {
        const cloned = cloneBoard(board);
        applyMoveOnBoard(cloned, piece.current_position, to, gameState);
        if (!isKingInCheck(cloned, piece.piece_name.startsWith('WHITE') ? 'WHITE' : 'BLACK')) {
            legal.push(to);
        }
    }

    // castling: requires gameState to inspect move history; if provided, consider castling targets
    if (gameState && piece.piece_name.endsWith('KING')) {
        const color = piece.piece_name.startsWith('WHITE') ? 'WHITE' : 'BLACK';
        const startRank = color === 'WHITE' ? '1' : '8';
        const kingStart = `e${startRank}`;
        const kingsideRookPos = `h${startRank}`;
        const queensideRookPos = `a${startRank}`;

        // only from starting square and king must not have moved
        const kingHasMoved = gameState.moveHistory.some((m) => m.piece === piece.piece_name);
        if (piece.current_position === kingStart && !kingHasMoved && !isKingInCheck(board, color)) {
            // kingside
            const f = `f${startRank}`;
            const g = `g${startRank}`;
            const rookSq = getSquare(board, kingsideRookPos);
            const rookHasMoved = gameState.moveHistory.some((m) => m.piece === `${color}_ROOK` && m.from === kingsideRookPos);
            if (rookSq && rookSq.piece && !rookHasMoved) {
                // squares between e and h must be empty: f and g
                if (isEmpty(board, f) && isEmpty(board, g)) {
                    // squares f and g must not be attacked
                    if (!isSquareAttacked(board, f, color === 'WHITE' ? 'BLACK' : 'WHITE') && !isSquareAttacked(board, g, color === 'WHITE' ? 'BLACK' : 'WHITE')) {
                        legal.push(g);
                    }
                }
            }

            // queenside
            const d = `d${startRank}`;
            const c = `c${startRank}`;
            const b = `b${startRank}`;
            const rookQs = getSquare(board, queensideRookPos);
            const rookQsHasMoved = gameState.moveHistory.some((m) => m.piece === `${color}_ROOK` && m.from === queensideRookPos);
            if (rookQs && rookQs.piece && !rookQsHasMoved) {
                // squares between a and e must be empty: b, c, d
                if (isEmpty(board, b) && isEmpty(board, c) && isEmpty(board, d)) {
                    // squares d and c must not be attacked
                    if (!isSquareAttacked(board, d, color === 'WHITE' ? 'BLACK' : 'WHITE') && !isSquareAttacked(board, c, color === 'WHITE' ? 'BLACK' : 'WHITE')) {
                        legal.push(c);
                    }
                }
            }
        }
    }

    return legal;
}

export { getPawnMoves, getSquare, isEmpty, isEnemy, getRookMoves, getBishopMoves, getKnightMoves, getQueenMoves, getKingMoves, getMovesForPiece, getLegalMovesForPiece, isKingInCheck };
