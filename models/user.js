var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var userSchema = new Schema({
    name: String,
    surName: String,
    userName: {type:String, required:true, unique:true},
    admin: Boolean,
    email: {type: String, unique:true},
    password: String
});

var User = mongoose.model('User',userSchema);

module.exports = User;