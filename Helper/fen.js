import * as pieceFactory from "../Data/pieces.js";

/**
 * Parses a standard Forsyth-Edwards Notation (FEN) string and constructs
 * a board state compatible with globalState.
 * @param {string} fen 
 * @returns {object} { board, currentTurn, halfmoveClock, fullmoveNumber, enPassant }
 */
export function parseFEN(fen) {
    const parts = fen.trim().split(/\s+/);
    const placement = parts[0];
    const activeColor = parts[1] || 'w';
    const castling = parts[2] || 'KQkq';
    const enPassant = parts[3] || '-';
    const halfmove = parseInt(parts[4] || '0', 10);
    const fullmove = parseInt(parts[5] || '1', 10);

    const board = [];
    const ranks = placement.split('/');
    
    for (let r = 0; r < 8; r++) {
        const rankStr = ranks[r];
        const row = [];
        let fileIdx = 0;
        
        for (let i = 0; i < rankStr.length; i++) {
            const char = rankStr[i];
            
            if (/\d/.test(char)) {
                const emptyCount = parseInt(char, 10);
                for (let e = 0; e < emptyCount; e++) {
                    const fileChar = String.fromCharCode(97 + fileIdx);
                    const rankNum = 8 - r;
                    row.push({
                        id: `${fileChar}${rankNum}`,
                        color: (r + fileIdx) % 2 === 0 ? 'white' : 'black',
                        piece: null,
                        highlighted: false
                    });
                    fileIdx++;
                }
            } else {
                const fileChar = String.fromCharCode(97 + fileIdx);
                const rankNum = 8 - r;
                const pieceColor = char === char.toUpperCase() ? 'WHITE' : 'BLACK';
                const pieceType = char.toLowerCase();
                let piece = null;
                const sqId = `${fileChar}${rankNum}`;

                if (pieceType === 'p') piece = pieceColor === 'WHITE' ? pieceFactory.whitePawn(sqId) : pieceFactory.blackPawn(sqId);
                else if (pieceType === 'r') piece = pieceColor === 'WHITE' ? pieceFactory.whiteRook(sqId) : pieceFactory.blackRook(sqId);
                else if (pieceType === 'n') piece = pieceColor === 'WHITE' ? pieceFactory.whiteKnight(sqId) : pieceFactory.blackKnight(sqId);
                else if (pieceType === 'b') piece = pieceColor === 'WHITE' ? pieceFactory.whiteBishop(sqId) : pieceFactory.blackBishop(sqId);
                else if (pieceType === 'q') piece = pieceColor === 'WHITE' ? pieceFactory.whiteQueen(sqId) : pieceFactory.blackQueen(sqId);
                else if (pieceType === 'k') piece = pieceColor === 'WHITE' ? pieceFactory.whiteKing(sqId) : pieceFactory.blackKing(sqId);

                row.push({
                    id: sqId,
                    color: (r + fileIdx) % 2 === 0 ? 'white' : 'black',
                    piece: piece,
                    highlighted: false
                });
                fileIdx++;
            }
        }
        board.push(row);
    }

    return {
        board,
        currentTurn: activeColor === 'w' ? 'WHITE' : 'BLACK',
        halfmoveClock: halfmove,
        fullmoveNumber: fullmove,
        enPassant: enPassant === '-' ? null : enPassant
    };
}

/**
 * Generates a standard FEN string from a given board and game state metadata.
 * @param {Array} board 
 * @param {object} gameState 
 * @returns {string} FEN representation
 */
export function toFEN(board, gameState) {
    let fenRanks = [];
    
    for (let r = 0; r < 8; r++) {
        let rankStr = '';
        let emptyCount = 0;
        
        for (let f = 0; f < 8; f++) {
            const square = board[r][f];
            if (!square.piece) {
                emptyCount++;
            } else {
                if (emptyCount > 0) {
                    rankStr += emptyCount;
                    emptyCount = 0;
                }
                const p = square.piece.piece_name;
                let char = '';
                
                if (p.includes('PAWN')) char = 'p';
                else if (p.includes('ROOK')) char = 'r';
                else if (p.includes('KNIGHT')) char = 'n';
                else if (p.includes('BISHOP')) char = 'b';
                else if (p.includes('QUEEN')) char = 'q';
                else if (p.includes('KING')) char = 'k';
                
                if (p.startsWith('WHITE')) {
                    char = char.toUpperCase();
                }
                rankStr += char;
            }
        }
        
        if (emptyCount > 0) {
            rankStr += emptyCount;
        }
        fenRanks.push(rankStr);
    }
    
    const activeColor = gameState.currentTurn === 'WHITE' ? 'w' : 'b';
    
    // Calculate castling availability based on current piece positions and move history
    let wK = true, wQ = true, bK = true, bQ = true;
    
    if (gameState.moveHistory) {
        gameState.moveHistory.forEach(m => {
            if (m.piece === 'WHITE_KING') { wK = false; wQ = false; }
            if (m.piece === 'BLACK_KING') { bK = false; bQ = false; }
            if (m.piece === 'WHITE_ROOK') {
                if (m.from === 'h1') wK = false;
                if (m.from === 'a1') wQ = false;
            }
            if (m.piece === 'BLACK_ROOK') {
                if (m.from === 'h8') bK = false;
                if (m.from === 'a8') bQ = false;
            }
        });
    }
    
    // Also verify rooks and kings are actually present on their original squares
    const a1 = board[7] && board[7][0] ? board[7][0].piece : null;
    const h1 = board[7] && board[7][7] ? board[7][7].piece : null;
    const e1 = board[7] && board[7][4] ? board[7][4].piece : null;
    const a8 = board[0] && board[0][0] ? board[0][0].piece : null;
    const h8 = board[0] && board[0][7] ? board[0][7].piece : null;
    const e8 = board[0] && board[0][4] ? board[0][4].piece : null;
    
    if (!e1 || e1.piece_name !== 'WHITE_KING') { wK = false; wQ = false; }
    if (!h1 || h1.piece_name !== 'WHITE_ROOK') wK = false;
    if (!a1 || a1.piece_name !== 'WHITE_ROOK') wQ = false;
    
    if (!e8 || e8.piece_name !== 'BLACK_KING') { bK = false; bQ = false; }
    if (!h8 || h8.piece_name !== 'BLACK_ROOK') bK = false;
    if (!a8 || a8.piece_name !== 'BLACK_ROOK') bQ = false;

    let castlingRights = '';
    if (wK) castlingRights += 'K';
    if (wQ) castlingRights += 'Q';
    if (bK) castlingRights += 'k';
    if (bQ) castlingRights += 'q';
    if (!castlingRights) castlingRights = '-';
    
    // En passant target square
    let enPassant = '-';
    if (gameState.lastMove && gameState.lastMove.piece && gameState.lastMove.piece.includes('PAWN')) {
        const fromRank = parseInt(gameState.lastMove.from[1], 10);
        const toRank = parseInt(gameState.lastMove.to[1], 10);
        if (Math.abs(fromRank - toRank) === 2) {
            const file = gameState.lastMove.to[0];
            const rank = fromRank === 2 ? 3 : 6;
            enPassant = `${file}${rank}`;
        }
    }

    const halfmove = gameState.halfmoveClock !== undefined ? gameState.halfmoveClock : 0;
    const fullmove = gameState.fullmoveNumber !== undefined ? gameState.fullmoveNumber : 1;

    return `${fenRanks.join('/')} ${activeColor} ${castlingRights} ${enPassant} ${halfmove} ${fullmove}`;
}
