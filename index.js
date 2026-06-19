import { initGameRender } from "./Render/main.js";
import { GlobalEvent, restartGame, clearIntervals, updateClockUI } from "./Events/global.js";
import { globalState, gameState } from "./Data/state.js";
import { toFEN } from "./Helper/fen.js";

// Check if running in Node test environment
const isTestEnv = typeof window === 'undefined' || !window.location || !window.location.host;

// Setup static DOM nodes (created once)
const root = document.getElementById("root");

// Create game wrapper container
const gameContainer = document.getElementById("gameContainer") || document.createElement("div");
gameContainer.id = "gameContainer";
gameContainer.className = "gameContainer";

if (root && root.parentNode && root.parentNode !== gameContainer) {
    root.parentNode.insertBefore(gameContainer, root);
    gameContainer.appendChild(root);
}

// Create sidebar container
const sidebar = document.getElementById("sidebar") || document.createElement("aside");
sidebar.id = "sidebar";
sidebar.className = "sidebar";
gameContainer.appendChild(sidebar);

// Create the menu container element
const menuScreen = document.createElement("div");
menuScreen.id = "menuScreen";
menuScreen.className = "menuScreen";
document.body.appendChild(menuScreen);

// Register back to menu callback
gameState.onBackToMenu = renderMenuScreen;

// Initialize components we might need in sidebar
const clocksCard = document.createElement("section");
clocksCard.id = "clocksCard";
clocksCard.className = "clocksCard hidden";
clocksCard.innerHTML = `
    <div class="clocksContainer">
        <div id="whiteClockCard" class="clockCard">
            <div class="clockLabel">WHITE</div>
            <div id="whiteClock" class="clockValue">--:--</div>
        </div>
        <div id="blackClockCard" class="clockCard">
            <div class="clockLabel">BLACK</div>
            <div id="blackClock" class="clockValue">--:--</div>
        </div>
    </div>
`;
sidebar.appendChild(clocksCard);

const gameBanner = document.createElement("section");
gameBanner.id = "gameBanner";
gameBanner.className = "gameBanner";
gameBanner.setAttribute("role", "status");
gameBanner.setAttribute("aria-live", "polite");
sidebar.appendChild(gameBanner);

const statusPanel = document.createElement("section");
statusPanel.id = "statusPanel";
statusPanel.className = "statusPanel";
statusPanel.innerHTML = `
	<div class="statusCard">
		<div class="statusLabel">Turn</div>
		<div id="turnIndicator" class="statusValue">White to move</div>
	</div>
	<div class="statusCard">
		<div class="statusLabel">Game State</div>
		<div id="gameStateIndicator" class="statusValue">ACTIVE</div>
		<div id="statusMessage" class="statusSubvalue">White to move</div>
		<div id="winnerIndicator" class="statusSubvalue muted">-</div>
	</div>
	<div class="statusCard historyCard">
		<div class="statusLabel">Move History</div>
		<ol id="moveHistoryList" class="moveHistoryList"></ol>
	</div>
`;
sidebar.appendChild(statusPanel);

const controls = document.createElement("section");
controls.id = "gameControls";
controls.className = "statusPanel controlPanel";
sidebar.appendChild(controls);

const navigation = document.createElement("section");
navigation.id = "gameNavigation";
navigation.className = "statusPanel controlPanel";
navigation.innerHTML = `
	<div class="statusCard controlCard navigationCard">
		<div class="statusLabel">Move Navigation</div>
		<div class="navigationButtons">
			<button type="button" class="controlButton navigationButton" data-action="nav-first" title="First Move">&lt;&lt;</button>
			<button type="button" class="controlButton navigationButton" data-action="nav-prev" title="Previous Move">&lt;</button>
			<button type="button" class="controlButton navigationButton" data-action="nav-next" title="Next Move">&gt;</button>
			<button type="button" class="controlButton navigationButton" data-action="nav-last" title="Current Position">&gt;&gt;</button>
		</div>
	</div>
`;
sidebar.appendChild(navigation);

const fenCard = document.createElement("section");
fenCard.id = "fenCard";
fenCard.className = "statusPanel controlPanel";
fenCard.innerHTML = `
    <div class="statusCard controlCard fenCardContainer">
        <div class="statusLabel">FEN Utility</div>
        <input type="text" id="fenInput" class="fenInput" placeholder="Paste FEN here..." />
        <div class="fenButtons">
            <button type="button" class="controlButton" data-action="load-fen">Load FEN</button>
            <button type="button" id="btnCopyFEN" class="controlButton" data-action="copy-fen">Copy FEN</button>
        </div>
    </div>
`;
sidebar.appendChild(fenCard);

const onlineCard = document.createElement("section");
onlineCard.id = "onlineCard";
onlineCard.className = "onlineCard hidden";
sidebar.appendChild(onlineCard);

// Function to render mode selection menu
export function renderMenuScreen() {
    clearIntervals();
    gameContainer.classList.add("hidden");
    menuScreen.classList.remove("hidden");
    
    menuScreen.innerHTML = `
        <div class="menuCard">
            <h1 class="menuTitle">Real-Time Chess</h1>
            <p class="menuSubtitle">Select Game Mode</p>
            <div class="menuOptions">
                <button type="button" class="menuButton" id="btnAnalysis">Analysis Board</button>
                <button type="button" class="menuButton" id="btnLocal">Local Game</button>
                <button type="button" class="menuButton" id="btnOnline">Online Game</button>
            </div>
        </div>
    `;

    document.getElementById("btnAnalysis")?.addEventListener("click", () => bootGame("ANALYSIS"));
    document.getElementById("btnLocal")?.addEventListener("click", renderLocalSetup);
    document.getElementById("btnOnline")?.addEventListener("click", renderOnlineSetup);
}

// Function to render local setup menu
function renderLocalSetup() {
    menuScreen.innerHTML = `
        <div class="menuCard">
            <h1 class="menuTitle">Local Match Setup</h1>
            <p class="menuSubtitle">Select Time Control</p>
            <div class="timeControlGrid">
                <button type="button" class="timeButton" data-time="60">1 Min (Bullet)</button>
                <button type="button" class="timeButton" data-time="180">3 Min (Blitz)</button>
                <button type="button" class="timeButton" data-time="300">5 Min (Blitz)</button>
                <button type="button" class="timeButton" data-time="600">10 Min (Rapid)</button>
                <button type="button" class="timeButton" data-time="1800">30 Min (Classical)</button>
            </div>
            <div class="setupActions">
                <button type="button" class="menuButton secondaryButton" id="btnBackToMenu">Back</button>
                <button type="button" class="menuButton" id="btnStartLocal" disabled>Start Match</button>
            </div>
        </div>
    `;

    let selectedTime = null;
    const timeButtons = menuScreen.querySelectorAll(".timeButton");
    const startBtn = document.getElementById("btnStartLocal");

    timeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            timeButtons.forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            selectedTime = parseInt(btn.dataset.time, 10);
            if (startBtn) startBtn.removeAttribute("disabled");
        });
    });

    document.getElementById("btnBackToMenu")?.addEventListener("click", renderMenuScreen);
    startBtn?.addEventListener("click", () => {
        if (selectedTime) bootGame("LOCAL", { timeControl: selectedTime });
    });
}

// Function to render online placeholder setup
function renderOnlineSetup() {
    menuScreen.innerHTML = `
        <div class="menuCard onlineCardMenu">
            <h1 class="menuTitle">Online Chess</h1>
            <div class="onlineDetails">
                <div class="placeholderIcon">🌐</div>
                <p class="onlinePlaceholderText">Networking Architecture prepared for Socket.io integration</p>
                
                <div class="architectureOutline">
                    <h3>Proposed Architecture</h3>
                    <ul>
                        <li>Client emits: <code>joinGame(roomId)</code>, <code>makeMove(moveData)</code>, <code>resign()</code></li>
                        <li>Server broadcasts: <code>gameStateUpdate</code>, <code>opponentMoved</code>, <code>opponentConnected</code></li>
                        <li>Heartbeat: latency sync & server-side clock verification</li>
                    </ul>
                </div>
                
                <div class="onlineForm">
                    <input type="text" class="onlineInput" placeholder="Enter Room ID" disabled />
                    <button type="button" class="menuButton" disabled>Connect (Coming Soon)</button>
                </div>
            </div>
            <button type="button" class="menuButton secondaryButton" id="btnBackFromOnline" style="margin-top: 20px;">Back to Menu</button>
        </div>
    `;
    
    document.getElementById("btnBackFromOnline")?.addEventListener("click", renderMenuScreen);
}

// Boot the game in a specific mode
export function bootGame(mode, options = {}) {
    gameState.mode = mode;
    menuScreen.classList.add("hidden");
    gameContainer.classList.remove("hidden");

    // Hide everything first
    clocksCard.classList.add("hidden");
    gameBanner.classList.add("hidden");
    statusPanel.classList.add("hidden");
    controls.classList.add("hidden");
    navigation.classList.add("hidden");
    fenCard.classList.add("hidden");
    onlineCard.classList.add("hidden");

    if (mode === "ANALYSIS") {
        gameBanner.classList.remove("hidden");
        statusPanel.classList.remove("hidden");
        
        controls.innerHTML = `
            <div class="statusCard controlCard">
                <button type="button" class="controlButton" data-action="restart">Restart Game</button>
                <button type="button" class="controlButton" data-action="undo">Undo Move</button>
                <button type="button" class="controlButton" data-action="flip">Flip Board</button>
                <button type="button" class="controlButton" data-action="export-pgn">Export PGN</button>
            </div>
        `;
        controls.classList.remove("hidden");
        navigation.classList.remove("hidden");
        fenCard.classList.remove("hidden");
    } 
    else if (mode === "LOCAL") {
        const timeControl = options.timeControl || 600;
        gameState.timeControl = timeControl;
        gameState.clocks = { WHITE: timeControl, BLACK: timeControl };
        
        clocksCard.classList.remove("hidden");
        gameBanner.classList.remove("hidden");
        statusPanel.classList.remove("hidden");
        
        controls.innerHTML = `
            <div class="statusCard controlCard">
                <button type="button" class="controlButton" data-action="new-game">New Game</button>
                <button type="button" class="controlButton" data-action="flip">Flip Board</button>
            </div>
        `;
        controls.classList.remove("hidden");
        
        updateClockUI();
    }
    else if (mode === "ONLINE") {
        onlineCard.innerHTML = `
            <div class="menuCard onlineCardMenu" style="box-shadow: none; background: transparent; padding: 0; margin: 0; width: 100%;">
                <h1 class="menuTitle">Online Chess</h1>
                <div class="onlineDetails">
                    <div class="placeholderIcon">🌐</div>
                    <p class="onlinePlaceholderText">Networking Architecture prepared for Socket.io integration</p>
                    
                    <div class="architectureOutline">
                        <h3>Proposed Architecture</h3>
                        <ul>
                            <li>Client emits: <code>joinGame(roomId)</code>, <code>makeMove(moveData)</code>, <code>resign()</code></li>
                            <li>Server broadcasts: <code>gameStateUpdate</code>, <code>opponentMoved</code>, <code>opponentConnected</code></li>
                            <li>Heartbeat: latency sync & server-side clock verification</li>
                        </ul>
                    </div>
                    
                    <div class="onlineForm">
                        <input type="text" class="onlineInput" placeholder="Enter Room ID" disabled />
                        <button type="button" class="menuButton" disabled>Connect (Coming Soon)</button>
                    </div>
                </div>
                <button type="button" class="menuButton secondaryButton" data-action="back-to-menu" style="margin-top: 20px; width: 100%;">Back to Menu</button>
            </div>
        `;
        onlineCard.classList.remove("hidden");
    }

    restartGame();
}

// Initial Boot logic
if (isTestEnv) {
    bootGame("ANALYSIS");
    GlobalEvent();
} else {
    renderMenuScreen();
    GlobalEvent();
}

export { globalState };
