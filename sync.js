
var Block = require("./blockchain").Block; 

let nodes = [
    "https://node-test-238108.appspot.com",
    "https://node-test2-238819.appspot.com"
];


//hatalı indexi onarma //hatalı blok indexini aktif serverdan iste
var syncBlock = function ( errorBlockIndex ){
    console.log("Hello from sync module ;) ");
    console.log(errorBlockIndex);
}




module.exports.syncBlock = syncBlock;