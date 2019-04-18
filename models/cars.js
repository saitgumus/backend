var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var carSchema = new Schema({
   saseNo: {type: String, required: true, unique: true},
   marka: String,
   model: String,
   seri: String,
   yakit: String,
   kasaTipi: String,
   motorHacmi: String,
   renk: String,
   km: String,
   comment: String
});

var Car = mongoose.model('Car',carSchema);

module.exports = Car;