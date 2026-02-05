import { ROOT_DIV } from "../Helper/constants.js";

function GlobalEvent(){
    ROOT_DIV.addEventListener("click",function(event){
        if(event.target.localName === "img"){
            const clickedId = event.target.parentNode.id;
            console.log(clickedId);
            
        }
    });
}

export { GlobalEvent };