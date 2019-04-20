var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var nodeShema = new Schema({
    host: {type:String},
    ip:{type:String},
    port:{type:String},
    path:{type:String}
})

var Node = mongoose.model('Node',nodeShema);

module.exports = Node;