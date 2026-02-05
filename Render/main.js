// import { blackPawn } from "../Data/pieces.js";
import * as piece from "../Data/pieces.js";
import { ROOT_DIV } from "../Helper/constants.js";


function initGameRender(data) {
    data.forEach((element) => {
        const rowEl = document.createElement("div");

        element.forEach((square) => {
            const squareDiv = document.createElement("div");
            squareDiv.id = square.id;

            squareDiv.classList.add(square.color, "square");

            //black pieces

            //black pawn
            if (square.id[1] == 7) {
                square.piece = piece.blackPawn(square.id);
            }
            //black rook
            if (square.id == 'h8' || square.id == 'a8') {
                square.piece = piece.blackRook(square.id);
            }
            //black knight
            if (square.id == 'g8' || square.id == 'b8') {
                square.piece = piece.blackKnight(square.id);
            }
            //black bishop
            if (square.id == 'f8' || square.id == 'c8') {
                square.piece = piece.blackBishop(square.id);
            }
            //black queen
            if (square.id == 'd8') {
                square.piece = piece.blackQueen(square.id);
            }

            //black king
            if (square.id == 'e8') {
                square.piece = piece.blackKing(square.id);
            }

            //white pieces

            //white pawn
            if (square.id[1] == 2) {
                square.piece = piece.whitePawn(square.id);
            }
            //white rook
            if (square.id == 'a1' || square.id == 'h1') {
                square.piece = piece.whiteRook(square.id);
            }
            //white knight
            if (square.id == 'b1' || square.id == 'g1') {
                square.piece = piece.whiteKnight(square.id);
            }
            //white bishop
            if (square.id == 'c1' || square.id == 'f1') {
                square.piece = piece.whiteBishop(square.id);
            }
            //white queen
            if (square.id == 'd1') {
                square.piece = piece.whiteQueen(square.id);
            }

            //white king
            if (square.id == 'e1') {
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
    data.forEach(row => {
        row.forEach(square => {
            if(square.piece){
                const squareEl = document.getElementById(square.id);
                
                const piece = document.createElement("img");
                piece.src = square.piece.img;
                piece.classList.add("piece");

                squareEl.appendChild(piece);
            }
        });
    });
}

export { initGameRender };
