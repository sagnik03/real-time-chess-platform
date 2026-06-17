import { initGameRender } from "./Render/main.js";
import { GlobalEvent } from "./Events/global.js";
import { globalState } from "./Data/state.js";

initGameRender(globalState);
GlobalEvent();

export { globalState };
