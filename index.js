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
	<div class="statusCard historyCard">
		<div class="statusLabel">Move History</div>
		<ol id="moveHistoryList" class="moveHistoryList"></ol>
	</div>
`;

root.insertAdjacentElement("afterend", statusPanel);

GlobalEvent();

export { globalState };
