import { ROOT_DIV } from "../Helper/constants.js";
import { globalState, gameState } from "../Data/state.js";
import { renderHighlight, clearHighlight, selfHighlight, clearPreviousSelfHighlight, moveElement } from "../Render/main.js";
import { getLegalMovesForPiece } from "../Data/engine.js";

let selfHighlightState = null;
let moveState = null;

function handlePawnSelection(piece) {
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
    const moves = getLegalMovesForPiece(globalState, piece);
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
    // perform DOM + state move
    moveElement(moveState, id);

    // record move
    gameState.moveHistory.push({ piece: moveState.piece_name, from, to: id });
    gameState.lastMove = { piece: moveState.piece_name, from, to: id };

    // toggle turn
    gameState.currentTurn = gameState.currentTurn === "WHITE" ? "BLACK" : "WHITE";

    // cleanup
    clearHighlight();
    clearPreviousSelfHighlight(selfHighlightState);
    selfHighlightState = null;
    moveState = null;
}

function GlobalEvent() {
    ROOT_DIV.addEventListener("click", function (event) {
        // if clicked on a piece image
        if (event.target.localName === "img") {
            const clickedId = event.target.parentNode.id;
            const square = globalState.flat().find((el) => el.id === clickedId);
            if (!square || !square.piece) return;

            // only handle pawns for now
            if (square.piece.piece_name === "WHITE_PAWN" || square.piece.piece_name === "BLACK_PAWN") {
                handlePawnSelection(square.piece);
            }
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