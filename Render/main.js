// import { blackPawn } from "../Data/pieces.js";
import * as piece from "../Data/pieces.js";
import { ROOT_DIV } from "../Helper/constants.js";
import { globalState } from "../Data/state.js";

function moveElement(piece, id) {

  const flatData = globalState.flat();
  flatData.forEach((el) => {
    if (el.id == piece.current_position) {
      delete el.piece;
    }
    if (el.id == id) {
      // clear any captured piece from the destination square before placing the mover
      el.piece = null;
      el.piece = piece;
    }
  });

  clearHighlight();

  const previousPiece = document.getElementById(piece.current_position);
  previousPiece.classList.remove("highlightYellow");
  const currentPiece = document.getElementById(id);

  // move the DOM node (image) safely instead of copying innerHTML
  const img = previousPiece.querySelector('img');
  if (img) {
    currentPiece.innerHTML = "";
    currentPiece.appendChild(img);
  } else {
    // fallback: clear and rely on state-driven render
    currentPiece.innerHTML = "";
    currentPiece.innerHTML = previousPiece.innerHTML;
  }
  // clear previous square's highlight and content if empty
  if (!previousPiece.querySelector('img')) previousPiece.innerHTML = "";



  piece.current_position = id;

}

function clearPreviousSelfHighlight(piece) {
  if (piece) {
    document
      .getElementById(piece.current_position)
      .classList.remove("highlightYellow");
  }
}

function selfHighlight(piece) {
  document
    .getElementById(piece.current_position)
    .classList.add("highlightYellow");
}

function initGameRender(data) {
  data.forEach((element) => {
    const rowEl = document.createElement("div");
    rowEl.setAttribute("role", "row");

    element.forEach((square) => {
      const squareDiv = document.createElement("div");
      squareDiv.id = square.id;
      squareDiv.setAttribute("role", "gridcell");
      squareDiv.setAttribute("aria-label", `Square ${square.id}`);
      squareDiv.setAttribute("tabindex", "0");

      squareDiv.classList.add(square.color, "square");

      //black pieces

      //black pawn
      if (square.id[1] == 7) {
        square.piece = piece.blackPawn(square.id);
      }
      //black rook
      if (square.id == "h8" || square.id == "a8") {
        square.piece = piece.blackRook(square.id);
      }
      //black knight
      if (square.id == "g8" || square.id == "b8") {
        square.piece = piece.blackKnight(square.id);
      }
      //black bishop
      if (square.id == "f8" || square.id == "c8") {
        square.piece = piece.blackBishop(square.id);
      }
      //black queen
      if (square.id == "d8") {
        square.piece = piece.blackQueen(square.id);
      }

      //black king
      if (square.id == "e8") {
        square.piece = piece.blackKing(square.id);
      }

      //white pieces

      //white pawn
      if (square.id[1] == 2) {
        square.piece = piece.whitePawn(square.id);
      }
      //white rook
      if (square.id == "a1" || square.id == "h1") {
        square.piece = piece.whiteRook(square.id);
      }
      //white knight
      if (square.id == "b1" || square.id == "g1") {
        square.piece = piece.whiteKnight(square.id);
      }
      //white bishop
      if (square.id == "c1" || square.id == "f1") {
        square.piece = piece.whiteBishop(square.id);
      }
      //white queen
      if (square.id == "d1") {
        square.piece = piece.whiteQueen(square.id);
      }

      //white king
      if (square.id == "e1") {
        square.piece = piece.whiteKing(square.id);
      }

      rowEl.append(squareDiv);
    });

    rowEl.classList.add("squareRow");
    ROOT_DIV.appendChild(rowEl);
  });

  pieceRender(data);
}

function pieceRender(data) {
  data.forEach((row) => {
    row.forEach((square) => {
      if (square.piece) {
        const squareEl = document.getElementById(square.id);

        const piece = document.createElement("img");
        piece.src = square.piece.img;
        piece.classList.add("piece");
        piece.alt = square.piece.piece_name.replace(/_/g, " ").toLowerCase();
        piece.setAttribute("draggable", "false");
        piece.setAttribute("aria-label", piece.alt);

        squareEl.appendChild(piece);
      }
    });
  });
}

function renderHighlight(squareId) {
  const highlightSpan = document.createElement("span");
  highlightSpan.classList.add("highlight");
  highlightSpan.setAttribute("aria-hidden", "true");
  document.getElementById(squareId).appendChild(highlightSpan);
}

function clearHighlight() {
  const flatData = globalState.flat();
  flatData.forEach((el) => {
    if (el.highlighted) {
      const squareEl = document.getElementById(el.id);
      const highlightNode = squareEl.querySelector('.highlight');
      if (highlightNode) squareEl.removeChild(highlightNode);
      el.highlighted = false;
    }
  });
}

export {
  initGameRender,
  renderHighlight,
  clearHighlight,
  selfHighlight,
  clearPreviousSelfHighlight,
  moveElement,
};
