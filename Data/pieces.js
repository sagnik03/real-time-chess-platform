//black pieces

function blackPawn(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bP.svg",
    piece_name : "BLACK_PAWN",
  }; 
}

function blackRook(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bR.svg",
    piece_name : "BLACK_ROOK",
  };
}

function blackKnight(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bN.svg",
    piece_name : "BLACK_KNIGHT",
  };
}

function blackBishop(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bB.svg",
    piece_name : "BLACK_BISHOP",
  };
}

function blackKing(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bK.svg",
    piece_name : "BLACK_KING",
  };
}

function blackQueen(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bQ.svg",
    piece_name : "BLACK_QUEEN",
  };
}

//white pieces

function whitePawn(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wP.svg",
    piece_name: "WHITE_PAWN",
  };
}

function whiteRook(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wR.svg",
    piece_name: "WHITE_ROOK",
  };
}

function whiteKnight(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wN.svg",
    piece_name: "WHITE_KNIGHT",
  };
}

function whiteBishop(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wB.svg",
    piece_name: "WHITE_BISHOP",
  };
}

function whiteKing(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wK.svg",
    piece_name: "WHITE_KING",
  };
}

function whiteQueen(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wQ.svg",
    piece_name: "WHITE_QUEEN",
  };
}

export {
  blackPawn,
  whitePawn,
  whiteBishop,
  whiteKing,
  whiteKnight,
  whiteQueen,
  whiteRook,
  blackBishop,
  blackKing,
  blackKnight,
  blackQueen,
  blackRook,
};
