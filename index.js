import { initGameRender } from "./Render/main.js";
import { GlobalEvent } from "./Events/global.js";
import { globalState } from "./Data/state.js";

initGameRender(globalState);

const root = document.getElementById("root");

const statusPanel = document.createElement("section");
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

root.insertAdjacentElement("afterend", statusPanel);

const controls = document.createElement("section");
controls.id = "gameControls";
controls.className = "statusPanel controlPanel";
controls.innerHTML = `
	<div class="statusCard controlCard">
		<button type="button" class="controlButton" data-action="restart">Restart Game</button>
		<button type="button" class="controlButton" data-action="undo">Undo Move</button>
	</div>
`;

statusPanel.insertAdjacentElement("afterend", controls);

GlobalEvent();

export { globalState };
