//frontend ile veri alışverişi 

const express = require('express');
const app = express();
const bodyParser = require('body-parser');

var main = require('./main')

var urlEncodedParser = bodyParser.urlencoded({extended:false});



app.get('/new', (req,res)=>{
    res.send('hello get');
})


app.post('/new',urlEncodedParser, (req,res)=>{
    let obj = {
        name : req.body.name,
        surname : req.body.surname
    };

    res.status(200).send(obj);
})




app.listen(3000,(err)=>{
    if(err) throw err;
    else
     console.log('successfully');
});

