var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var nodeShema = new Schema({
    ip:{type:String, unique:true, required:true},
    port:{type:String,required:true},
    path:{type:String}
})

var Node = mongoose.model('Node',nodeShema);

module.exports = Node;