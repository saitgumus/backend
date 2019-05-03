const express = require("express");
const app = express();
const cors = require('cors');
const bodyParser = require("body-parser");
const dateFormat = require("dateformat");
const sha256 = require("sha256");
const Request = require("request");
const axios = require("axios");

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


//connection veriables
let db_urls = [
  'mongodb://localhost:27017/carchain',
  'mongodb://carchainadmin:carchain1@ds357955.mlab.com:57955/chaincar',
  'mongodb://node2:nodetest2@ds056549.mlab.com:56549/node-test2'
];

//server veriables
let nodes = [
  //"http://localhost:8080",
  "https://node-test-238108.appspot.com",
  "https://node-test2-238819.appspot.com"
];

//son block 
let lastBlock = {
  "index":0
};





app.use(cors()); 

app.use(bodyParser.json());//json formatlarını pars edecek

//blockchain ***
let BlockChain = require("./blockchain").BlockChain;
let Transaction = require("./blockchain").Transaction;
let _Block = require("./blockchain").Block;


let testChain = new BlockChain();

//connection the db
 mongoose.connect(db_urls[0],{useNewUrlParser:true},err => { //uri, { useNewUrlParser: true }, err =>
  if (err) throw err;
  else console.log("connection successful");
});



//blockları doğrulama
//  let isValidBlocks = new Promise( (res,rej)=>{
//     Block.find({},(err,data)=>{
//       for(let i=1;i<data.length ; i++){
//         if(data[i].previousHash !== data[i-1].hash )
//               rej(data[i-1]);
//           else if(data[i].hash !== sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString() )
//           {
//             //console.log(data[i].hash);
//             //console.log(sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString());
//             reject(data[i]);
//           }
//           console.log('test edildi: '+ data[i-1].index);
//       }
//     }).sort({index:1})
//  })


//  SYNC functions- * -

let syncUser = (user)=>{
  nodes.forEach( (element)=>{
    axios.post(element+'/newuser',user).then( (res)=>{
      console.log(res.body);
    }).catch( (err)=>{
      console.log(err);
    })
  })
}


let syncCar = (car)=>{
  nodes.forEach( (element)=>{
    axios.post(element+'/newcar',car).then( (res)=>{
      console.log(res.body);
    }).catch( (err)=>{
      console.log(err);
    })
  })
}


//yeni oluşturulan bloğu diğer serverlara dağıtma..
let syncBlock = (block)=>{
  let message = {};
    nodes.forEach( (element)=>{
      axios.post(element+'/newBlock',block)
      .then( (res)=>{
          if(res.statusCode == 200){
            console.log("blok "+element+" e eklendi.");
            message = res.body;
          }else{
            message = res.body;
          }
        }
      ).catch( (err)=>{
        console.log(err);
      })
    })
    return message;
}


//istenilen index numaralı bloğu başka serverdan alma
let getOneBlock = (index)=>{
  axios.post( nodes[0]+'/oneBlock', {"index":index})
  .then( (res)=>{
    return res.body;
  })
}









//// ROUTER BODY /////

app.get('/', (req,res)=>{
  res.end('hello carchain.. from server-2');
})


//yeni işlem ekleme
app.post("/newTransaction", (req, res) => {


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
          if(data.length == 0 || data[0].index != 0){

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
            //doğrulama
          for( i=1;i<data.length ; i++){
            if(data[i].previousHash !== data[i-1].hash )
                  reject(data[i-1]);
              else if(data[i].hash !== sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString() )
              {
                //console.log(data[i].hash);
                //console.log(sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString());

                reject(data[i]);
              }
            //  console.log('test edildi: '+ data[i-1].index);
          }

          resolve(data[i-1]);
        }
      }).sort({index:1})
    })
    .then( (lastBlock)=>{
    
  //askıdaki işlemleri temizle
  let time = dateFormat();

  let _block = new Block({
    index: lastBlock.index+1,
    timeStamp: time.toString(),
    transactions: testChain.pendingTransactions,
    previousHash: lastBlock.hash,
    hash: sha256((lastBlock.index+1).toString() + time.toString() + JSON.stringify(testChain.pendingTransactions) +lastBlock.hash).toString()
  });

  new Promise( (resolve,reject)=>{
    let message = syncBlock(_Block);

    if(message.sonuc || message.index){
      resolve(message)
    }else{
      reject('blok dağıtımı yapılamadı');
    }

   }).then( (res)=>{
     if(res.index){
       let oldBlock = new Block(res);
       oldBlock.save( (err)=>{
         if(err) throw err;
         console.log('serverdan gelen eski blok eklendi');
       })
     }
   }).catch( (mesaj)=>{
     console.log(mesaj);
   })

  _block.save( (err)=>{
    if(err) throw err;


    testChain.pendingTransactions = [];
    console.log('yeni block veri tabanına eklendi. index: ' + _block.index);
  });

    }).catch( (invalidBlock)=>{
      console.log('hatalı block : ');
      console.log(invalidBlock);
      let newBlock = new Block(getOneBlock(invalidBlock.index))

      newBlock.save( (err)=>{
        if(err) throw err;
        else console.log('blok düzeltildi');
      })
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



//block sync
app.post("/getLastBlock",(req,res)=>{
  //cevap olarak son bloğu gönder
  Block.find({},(err,data)=>{
    if(err) throw err;
    res.json(data);
  }).sort({index:-1}).limit(1);
})

//diğer bir serverdan yeni blok geldiğinde
app.post("/newBlock",(req,res)=>{
  let newBlockIndex = req.index;
  let lastBlock;
    Block.find({}, (err,data)=>{
      if(err) throw err;

      lastBlock = data;
    })

    if(lastBlock.index < newBlockIndex){
      let newBlock = new Block(req.body);
      newBlock.save( (err)=>{
        if(err) throw err;

        res.statusCode(200).json({"sonuc":"yeni block eklendi"});
      })
    }else if(lastBlock.index == newBlockIndex){
      res.statusCode(405).json(lastBlock);
    }

})

//index numarsı verilen bloğu ver..
app.post("/oneBlock",(req,res)=>{
  Block.findOne({'index':req.body.index}, (err,data)=>{
    if (err) throw err;
    else{
      res.json(data);
    }
  })
})




// yeni kullanıcı ekle ***
app.post("/newuser", (req, res) => { 
  var user = new User(req.body);

  user.save(function(err) {
    if (err) throw err;

    res.status(200).send(user);
    console.log("user Saved: " + user.name);
  })
 
  syncUser(user);
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
  syncCar(_car);
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










app.listen(8080, err => {
  if (err) throw err;
  else console.log("successfully listening :8080 ");
});
