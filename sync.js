
var Block = require("./blockchain").Block; 



//hatalı indexi onarma //hatalı blok indexini aktif serverdan iste
var syncBlock = function ( errorBlockIndex ){
    console.log("Hello from sync module ;) ");
    console.log(errorBlockIndex);
}

//aktif server bulma
var searchActive = function(){

}



module.exports.syncBlock = syncBlock;