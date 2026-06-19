import { spawn } from 'child_process';
import { io } from 'socket.io-client';

console.log("=== RUNNING ONLINE MATCHMAKING & GAMEPLAY LIFECYCLE TESTS ===");

const PORT = '3005';
const serverProcess = spawn('node', ['server.js'], {
    env: { ...process.env, PORT }
});

// Wait for server to boot
await new Promise(resolve => setTimeout(resolve, 1500));

let client1 = null;
let client2 = null;

try {
    // 1. Connect Client 1
    client1 = io(`http://localhost:${PORT}`);
    await new Promise((resolve, reject) => {
        client1.on('connect', resolve);
        client1.on('connect_error', reject);
        setTimeout(() => reject(new Error("Client 1 connect timeout")), 3000);
    });
    console.log("PASS: Client 1 connected to server");

    // 2. Client 1 creates a room
    let createdRoomId = null;
    let client1Color = null;
    client1.emit('createRoom', { timeControl: 300 });

    await new Promise((resolve, reject) => {
        client1.on('roomCreated', ({ roomId, playerColor, timeControl }) => {
            createdRoomId = roomId;
            client1Color = playerColor;
            if (roomId && (playerColor === "WHITE" || playerColor === "BLACK") && timeControl === 300) {
                resolve();
            } else {
                reject(new Error(`Invalid roomCreated payload: ${JSON.stringify({ roomId, playerColor, timeControl })}`));
            }
        });
        setTimeout(() => reject(new Error("roomCreated timeout")), 3000);
    });
    console.log(`PASS: Room created with ID: ${createdRoomId}, Client 1 assigned color: ${client1Color}`);

    // 3. Connect Client 2
    client2 = io(`http://localhost:${PORT}`);
    await new Promise((resolve, reject) => {
        client2.on('connect', resolve);
        client2.on('connect_error', reject);
        setTimeout(() => reject(new Error("Client 2 connect timeout")), 3000);
    });
    console.log("PASS: Client 2 connected to server");

    // 4. Client 2 joins the room and game starts
    client2.emit('joinRoom', { roomId: createdRoomId });

    let gameStartedData1 = null;
    let gameStartedData2 = null;

    await Promise.all([
        new Promise((resolve, reject) => {
            client1.on('gameStart', (data) => {
                gameStartedData1 = data;
                resolve();
            });
            setTimeout(() => reject(new Error("gameStart Client 1 timeout")), 3000);
        }),
        new Promise((resolve, reject) => {
            client2.on('gameStart', (data) => {
                gameStartedData2 = data;
                resolve();
            });
            setTimeout(() => reject(new Error("gameStart Client 2 timeout")), 3000);
        })
    ]);

    if (gameStartedData1.roomId === createdRoomId &&
        gameStartedData2.roomId === createdRoomId &&
        gameStartedData1.playerColors.WHITE &&
        gameStartedData1.playerColors.BLACK) {
        console.log("PASS: gameStart event received by both clients with matching payloads");
    } else {
        throw new Error("Mismatch in gameStart payloads");
    }

    // Identify who is white and who is black
    const whiteClient = gameStartedData1.playerColors.WHITE === client1.id ? client1 : client2;
    const blackClient = gameStartedData1.playerColors.WHITE === client1.id ? client2 : client1;

    // 5. White makes a move and Black receives it
    const movePayload = {
        roomId: createdRoomId,
        from: "e2",
        to: "e4",
        promotion: null,
        san: "e4",
        clocks: { WHITE: 295, BLACK: 300 }
    };

    whiteClient.emit('makeMove', movePayload);

    await new Promise((resolve, reject) => {
        blackClient.on('opponentMoved', ({ from, to, promotion, san, clocks }) => {
            if (from === "e2" && to === "e4" && promotion === null && san === "e4" && clocks.WHITE === 295) {
                resolve();
            } else {
                reject(new Error(`Invalid opponentMoved payload: ${JSON.stringify({ from, to, promotion, san, clocks })}`));
            }
        });
        setTimeout(() => reject(new Error("opponentMoved timeout")), 3000);
    });
    console.log("PASS: Move synchronization works correctly between opponents");

    // 6. Resignation test
    whiteClient.emit('resign', { roomId: createdRoomId });

    let gameOverData1 = null;
    let gameOverData2 = null;

    await Promise.all([
        new Promise((resolve, reject) => {
            client1.on('gameOver', (data) => {
                gameOverData1 = data;
                resolve();
            });
            setTimeout(() => reject(new Error("gameOver Client 1 timeout")), 3000);
        }),
        new Promise((resolve, reject) => {
            client2.on('gameOver', (data) => {
                gameOverData2 = data;
                resolve();
            });
            setTimeout(() => reject(new Error("gameOver Client 2 timeout")), 3000);
        })
    ]);

    const winnerColor = "BLACK";
    if (gameOverData1.winner === winnerColor && gameOverData1.reason === "resignation" &&
        gameOverData2.winner === winnerColor && gameOverData2.reason === "resignation") {
        console.log("PASS: Resignation handled correctly, opposite color declared winner");
    } else {
        throw new Error(`Invalid gameOver data: ${JSON.stringify({ gameOverData1, gameOverData2 })}`);
    }

    console.log("=== ALL ONLINE INTEGRATION TESTS PASSED ===");
} catch (error) {
    console.error("FAIL: Online test suite failed!", error);
    process.exitCode = 1;
} finally {
    if (client1) client1.disconnect();
    if (client2) client2.disconnect();
    serverProcess.kill();
}
