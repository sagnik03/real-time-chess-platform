import { ROOT_DIV } from "../Helper/constants.js";
import { globalState } from "../index.js";
import { renderHighlight } from "../Render/main.js";
import { clearHighlight } from "../Render/main.js";

let highlight_state = false;

function whitePawnClick({piece}){
    const current_pos = piece.current_position;
    const flatArray = globalState.flat();

    if(current_pos[1] === "2"){
        const highlightSquareId = [
            `${current_pos[0]}${Number(current_pos[1]) + 1}`,
            `${current_pos[0]}${Number(current_pos[1]) + 2}`,            
    ];

    highlightSquareId.forEach((highlight) => {

        globalState.forEach((row )=> {
            row.forEach((element) => {
                if(element.id == highlight){
                    element.highlight = true;
                }
            });
        });
        if(highlight_state) clearHighlight();
        renderHighlight(highlight);
        
        highlight_state = true;
    });

    }
    
}

function GlobalEvent(){
    ROOT_DIV.addEventListener("click",function(event){
        if(event.target.localName === "img"){
            const clickedId = event.target.parentNode.id;
            const flatArray = globalState.flat();
            const square = flatArray.find((el) => el.id == clickedId);
            if(square.piece.piece_name == "WHITE_PAWN"){
                whitePawnClick(square);
            }
            
        }
    });
}

export { GlobalEvent };