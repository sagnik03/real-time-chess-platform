import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static chess game files
app.use(express.static(__dirname));

const rooms = {}; // In-memory database of active chess rooms

function generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

io.on('connection', (socket) => {
    let socketRoomId = null;
    let socketColor = null;

    socket.on('createRoom', ({ timeControl }) => {
        const roomId = generateRoomCode();
        const playerColor = Math.random() < 0.5 ? "WHITE" : "BLACK";
        
        rooms[roomId] = {
            id: roomId,
            timeControl: timeControl,
            players: {
                WHITE: playerColor === "WHITE" ? socket.id : null,
                BLACK: playerColor === "BLACK" ? socket.id : null
            },
            clocks: { WHITE: timeControl, BLACK: timeControl },
            status: "WAITING"
        };
        
        socketRoomId = roomId;
        socketColor = playerColor;
        socket.join(roomId);
        
        socket.emit('roomCreated', { roomId, playerColor, timeControl });
    });

    socket.on('joinRoom', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) {
            socket.emit('errorMsg', 'Room not found');
            return;
        }
        if (room.status !== "WAITING") {
            socket.emit('errorMsg', 'Room is full or active');
            return;
        }
        
        const playerColor = room.players.WHITE ? "BLACK" : "WHITE";
        room.players[playerColor] = socket.id;
        room.status = "ACTIVE";
        
        socketRoomId = roomId;
        socketColor = playerColor;
        socket.join(roomId);
        
        io.to(roomId).emit('gameStart', {
            roomId,
            playerColors: {
                WHITE: room.players.WHITE,
                BLACK: room.players.BLACK
            },
            timeControl: room.timeControl,
            clocks: room.clocks
        });
    });

    socket.on('makeMove', ({ roomId, from, to, promotion, san, clocks }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        if (clocks) {
            room.clocks = clocks;
        }
        
        socket.to(roomId).emit('opponentMoved', {
            from,
            to,
            promotion,
            san,
            clocks: room.clocks
        });
    });

    socket.on('timeout', ({ roomId, loserColor }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        const winnerColor = loserColor === "WHITE" ? "BLACK" : "WHITE";
        io.to(roomId).emit('gameOver', {
            winner: winnerColor,
            reason: "timeout"
        });
        delete rooms[roomId];
    });

    socket.on('resign', ({ roomId }) => {
        const room = rooms[roomId];
        if (!room) return;
        
        const winnerColor = socketColor === "WHITE" ? "BLACK" : "WHITE";
        io.to(roomId).emit('gameOver', {
            winner: winnerColor,
            reason: "resignation"
        });
        delete rooms[roomId];
    });

    socket.on('disconnect', () => {
        if (socketRoomId && rooms[socketRoomId]) {
            const room = rooms[socketRoomId];
            socket.to(socketRoomId).emit('opponentDisconnected', {
                winner: socketColor === "WHITE" ? "BLACK" : "WHITE"
            });
            delete rooms[socketRoomId];
        }
    });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
