var mongoose = require('mongoose');
var Schema = mongoose.Schema;





var blockShema = new Schema({
    index : {type:Number, unique:true, required:true },
    timeStamp:{type:String},
    transactions:{type:Array},
    previousHash:{type:String},
    hash:{type:String}
})

var Block = mongoose.model('Block',blockShema);

module.exports = Block;