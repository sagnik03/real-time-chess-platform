//black pieces

function blackPawn(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bP.svg",
  };
}

function blackRook(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bR.svg",
  };
}

function blackKnight(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bN.svg",
  };
}

function blackBishop(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bB.svg",
  };
}

function blackKing(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bK.svg",
  };
}

function blackQueen(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/black/bQ.svg",
  };
}

//white pieces

function whitePawn(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wP.svg",
  };
}

function whiteRook(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wR.svg",
  };
}

function whiteKnight(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wN.svg",
  };
}

function whiteBishop(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wB.svg",
  };
}

function whiteKing(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wK.svg",
  };
}

function whiteQueen(current_position) {
  return {
    current_position,
    img: "Assets/images/pieces/white/wQ.svg",
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
