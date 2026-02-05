import { initGame } from "./Data/data.js";
import { initGameRender } from "./Render/main.js";
import { GlobalEvent } from "./Events/global.js";


const globalState = initGame();

initGameRender(globalState);
GlobalEvent();

