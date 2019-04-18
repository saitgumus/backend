const express = require("express");
const app = express();
const cors = require('cors');
const bodyParser = require("body-parser");
const dateFormat = require("dateformat");
const sha256 = require("sha256");
const Request = require("request");

var mongoose = require("mongoose");

//**for sync */
var sync = require("./sync");


// ***Models***
var User = require("./models/user");
var Car = require("./models/cars");
var Block = require("./models/Block");
var Node = require("./models/nodeServer");


//create json token **
var jwt = require('jwt-simple');
var payload = { };
var secret = 'xxx';


app.use(cors()); 
app.use(bodyParser.json());//json formatlarını pars edecek

//blockchain ***
let BlockChain = require("./blockchain").BlockChain;
let Transaction = require("./blockchain").Transaction;
let _Block = require("./blockchain").Block;


let testChain = new BlockChain();

let nodePort = "3000";
let nodePath = "127.0.0.1";

//connection the db
let uri = "mongodb://localhost:27017/carchain";

 mongoose.connect(uri,{useNewUrlParser:true},err => { //uri, { useNewUrlParser: true }, err =>
  if (err) throw err;
  else console.log("connection successful");


});


// IP Control
let ipControl = function(_ip){

Node.find({'ip':_ip},'ip',(err,data)=>{
  if(err) throw err;
  
  if(data.length == 0){
   let _node = new Node({
     ip: _ip,
     port:"3000",
     path: "/syncBlock"
   })
   _node.save( (err)=>{
     if(err) throw err;

     console.log('ip eklendi.');
   } )

  }

  
})

}







//// ROUTER BODY /////

app.get('/', (req,res)=>{
  res.end('hello carchain..');
})

//yeni işlem ekleme
app.post("/newTransaction", (req, res) => {

//ip adresi almak için api
Request("http://myexternalip.com/raw",(err,resp,ip)=>{
 ipControl(ip);
})

  let _transaction = new Transaction(
    req.body.user,
    req.body.chassisNo,
    req.body.km,
    req.body.transaction,
    req.body.comment
  );

  testChain.addPendingTransaction(_transaction);


  res.status(200).json({"sonuc":"islem alındı."});
   

  if(testChain.pendingTransactions.length >= 3){

    new Promise( (resolve,reject)=>{
      
      Block.find({},(err,data)=>{
        if(err) throw err;
        else{

          //genesis denetleme gövdesi
          if(data.length == 0){

            //create genesis
            let genesis = testChain.Chain[0];
            let _genesis = new Block({
              index: genesis.index,
              timeStamp: genesis.timeStamp,
              transactions: genesis.transactions,
              previousHash: genesis.previousHash,
              hash: genesis.hash
            });

            _genesis.save( (err)=>{
              if(err) throw err;
              else console.log('genesis oluşturuldu!');
            } );
          }


          //yeni block ekleme
          let i=0;
          for( i=1;i<data.length ; i++){
            if(data[i].previousHash !== data[i-1].hash )
                  reject(data[i-1]);
              else if(data[i].hash !== sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString() )
              {
                reject(data[i]);
              }
              console.log('test edildi: '+ data[i-1].index);
          }

          resolve(data[i-1]);
        }
      }).sort({index:1})
    })
    .then( (lastBlock)=>{
      //yeni geçici blok (hash hesaplaması blockchain sınıfında tamamlanıp sonra DB'ye gönderilecek).
  // gBlock = new _Block(
  //   lastBlock.index+1,
  //   dateFormat(),
  //   testChain.pendingTransactions,
  //   lastBlock.hash
  // )

  //askıdaki işlemleri temizle
  let time = dateFormat();

  let _block = new Block({
    index: lastBlock.index+1,
    timeStamp: time.toString(),
    transactions: testChain.pendingTransactions,
    previousHash: lastBlock.hash,
    hash: sha256((lastBlock.index+1).toString() + time.toString() + JSON.stringify(testChain.pendingTransactions) +lastBlock.hash).toString()
  });



  _block.save( (err)=>{
    if(err) throw err;


    testChain.pendingTransactions = [];
    console.log('yeni block veri tabanına eklendi. index: ' + _block.index);
  });

    }).catch( (invalidBlock)=>{
      //console.log('hatalı block : ');
      //console.log(invalidBlock);
      sync.syncBlock(invalidBlock.index)
    })

   }

   
  
});



//işlem dökümanı 
app.post("/queryTransaction",(req,res)=>{

  Block.find({'transactions.chassisNo':req.body.chassisNo},'transactions',(err,data)=>{
    if(err) throw err;
    else {
      //console.log(data);
      res.status(200).send(data);
    }
  })
})



// yeni kullanıcı ekle ***

app.post("/newuser", (req, res) => { //("/newuser", urlEncodedParser, (req, res) => {

  var user = new User(req.body);

  user.save(function(err) {
    if (err) throw err;

    res.status(200).send(user);
    console.log("user Saved: " + user.name);
  });
});

//kullanıcı sorgulama
app.post("/newuser/valid", (req,res)=>{

  User.findOne({'userName':req.body.userName},(err,data)=>{
    if(err) throw err;

    if(data){
      res.json({"durum":1});
    }else{
      res.json({"durum":0});
    }

  })
})



//
//yeni araç ekleme
app.post("/newcar", (req, res) => {
  let _car = new Car(req.body);

  _car.save(function(err) {
    if (err) throw err;

    res.status(200).json({"sonuc":"başarılı"});
    console.log("car Saved sase: " + _car.saseNo);
  });
});

//şase sorgulama
app.post("/newcar/valid", (req, res) => {
  console.log('car valid ');
  console.log(req.body);

  Car.findOne({'saseNo':req.body.chassisNo},(err,data)=>{
    if(err) throw err;
    
    if(data){
      res.status(200).json({"durum":1});
    }else{
      res.json({"durum":0});
    }
  })

});








app.listen(3000, err => {
  if (err) throw err;
  else console.log("successfully listening :3000 ");
});
