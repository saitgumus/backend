const express = require("express");
const app = express();
const cors = require('cors');
const bodyParser = require("body-parser");
const dateFormat = require("dateformat");
const sha256 = require("sha256");
const axios = require("axios");

var server = require('http').createServer(app)
var io = require('socket.io').listen(server)


var mongoose = require("mongoose");

// ***Models***
var User = require("./models/user");
var Car = require("./models/cars");
var Block = require("./models/Block");


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
 // "https://node-test-238108.appspot.com",
  "https://node-test2-238819.appspot.com"
];


//zincirin en büyük index numarasını saklamak için kullanılacak..
let LastBlockData = {
  "index":"",
  "hash":""
}


app.use(cors()); 

app.use(bodyParser.json());//json formatlarını pars edecek

//blockchain ***
let BlockChain = require("./blockchain").BlockChain;
let Transaction = require("./blockchain").Transaction;


let testChain = new BlockChain();

//connection the db
 mongoose.connect(db_urls[1],{useNewUrlParser:true},err => {
  if (err) throw err;
  else console.log("database connection successfully");
});








//blockchain validations
let isValidBlock = function(block){
  return new Promise( (resolve,reject)=>{
    if(block.hash == sha256(block.index.toString()+block.timeStamp+JSON.stringify(block.transactions)+block.previousHash).toString()){
      console.log('blok doğrulandı')
      resolve (true)
    }else{
      console.log('blok doğrulamadı')
      // console.log(block.hash);
      // console.log(sha256(block.index.toString()+block.timeStamp+JSON.stringify(block.transactions)+block.previousHash).toString())
      reject (false)
    }
  })
    
}


//veritabanındaki son blok indexini alır
let getLastIndexAndHash = ()=>{
  return new Promise(
    (res,rej)=>{
      Block.find({},{'index':1,'hash':1}, (e,d)=>{
      if(!e) res(d[0])
      else rej(e)
      }).sort({'index':-1}).limit(1);
      
    }
  )
  }

  //diğer serverlardan blok bilgisini al..
let reqLastBlockData = async()=>{
  let data = LastBlockData;
  for(item of nodes){
    await axios.post(item+'/getlastblockdata').then(
      (r=>{
        if(data.index<r.data.index)
            data = r.data
      })
    ).catch(
      e=>{throw e}
    )
  }
  return data;
}
  //lastblockdata'ya son kaydedilen block bilgilerini atar.. Bu fonk. yeni blok oluşturulduğu anda çalışır.
let updateLastBlockData = async ()=>{
  await getLastIndexAndHash().then(
    r=>{
      LastBlockData.index = r.index
      LastBlockData.hash = r.hash
    }
  ).catch( e=> console.log(e));
}



//  SYNC functions- * -

let syncUser = async (user)=>{
    for(item of nodes){
     await SendPost(item+'/addUser',user).then( (res)=>{
       sendMessageToSocket(res)
     }).catch( e=>{sendMessageToSocket(e)})
    }
}


let syncCar = async (car)=>{
  sendMessageToSocket('sync.. for new car.');
  for(item of nodes){
    await SendPost(item+'/addCar',car).then(
      r=>{sendMessageToSocket(item+': '+r)}
    )
  }
}


//yeni oluşturulan bloğu diğer serverlara dağıtma..
let syncBlock = async (block)=>{
  sendMessageToSocket('new block sync..');
for(item of nodes){
  await SendPost(item+'/newBlock',block).then(
    r=>{sendMessageToSocket(item+': '+r)}
  )
}
}


//istenilen index numaralı bloğu başka serverdan alma
let getOneBlock = async (index)=>{

  for(item of nodes){
    await axios.post(item+'/oneBlock', {"index":index})
    .then( r=>{
      if(r.data.index != 0) 
          return r.data
    }).catch( e=>{console.log(e)})
  }
  
sendMessageToSocket('hatalı block diğer serverlardan alınamadı');
  
return new Block({
  index: 0,
  timeStamp:'',
  transactions:[],
  previousHash: '',
  hash: ''
});
}


//eksik olan bloğu tamamlamak için
let eksikBlokTamamla = async (index)=>{
   let block = getOneBlock(index)

   if(block.index != 0){
     block.save( (err)=>{
       if(err) throw err;

       sendMessageToSocket('eksik blok eklendi.')
       console.log('eksik blok eklendi.')
     })
   }
}














//// ROUTER BODY /////

app.get('/', (req,res)=>{
  // res.end('hello carchain.. from server-1 -addCar entegre adildi- change /newBlock (version s1 1.1)');
  res.sendFile( __dirname+'/index.html')
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
   sendMessageToSocket('yeni islem alındı..');

  if(testChain.pendingTransactions.length >= 3){
    updateLastBlockData();
    new Promise( (resolve,reject)=>{  
      //diğer serverlardan alınan son blok bilgisi..
      let reqData = reqLastBlockData();


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
            sendMessageToSocket('checking the chain...');
          for( i=1;i<data.length ; i++){
           
            //hashler kontrolü
            if(data[i].previousHash !== data[i-1].hash )
                  reject(data[i-1]);
            
            //içerik ve hash kontrolü
            if(data[i].hash !== sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString() )
              {
                reject(data[i]);
              }
            //  console.log('test edildi: '+ data[i-1].index);
          }
          sendMessageToSocket('checked chain index:0 to index:'+data[i-1].index.toString());
          resolve(reqData);
        }
      }).sort({index:1})
    })
    .then( (lastBlock)=>{
    
//zamanı al
  let time = dateFormat();


//yeni blok oluştur
  let _block = new Block({
    index: lastBlock.index+1,
    timeStamp: time.toString(),
    transactions: testChain.pendingTransactions,
    previousHash: lastBlock.hash,
    hash: sha256((lastBlock.index+1).toString() + time.toString() + JSON.stringify(testChain.pendingTransactions) +lastBlock.hash).toString()
  });

  _block.save( (err)=>{
    if(err) throw err;

//son blok bilgisini güncelle ve askıyı temizle
    updateLastBlockData();
    testChain.pendingTransactions = [];
    console.log('yeni block veri tabanına eklendi. index: ' + _block.index);
    sendMessageToSocket('new block is added to mydb.. index:'+_block.index);
  });

  //bloğu dağıt
  syncBlock(_block);

    }).catch( (invalidBlock)=>{
      //hatalı bloğu kaldır
        Block.findOneAndDelete({index:invalidBlock.index},(err,res)=>{
          if(err) throw err;

          console.log('hatalı blog silindi');
        })
      

      //hatalının yerine yenisini diğer serverlardan al
      let newBlock = new Block(getOneBlock(invalidBlock.index))
      sendMessageToSocket(invalidBlock.index+' index numaralı block onarılıyor');

      if(newBlock.index != 0){
        newBlock.save( (err)=>{
          if(err) throw err;
          else{
            console.log('blok düzeltildi');
          sendMessageToSocket('onarılma tamamlandı.');
          }
        })
      }else{
        sendMessageToSocket('hatalı block onarılamadı..');
      }
      
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



//block sync için
app.post("/getLastBlock",(req,res)=>{
  //cevap olarak son bloğu gönder
  Block.find({},(err,data)=>{
    if(err) throw err;
    res.json(data);
  }).sort({index:-1}).limit(1);
})


//diğer bir serverdan yeni blok geldiğinde
app.post("/newBlock",(req,res)=>{
  
    let newBlock = new Block(req.body);
    newBlock.save( (err)=>{
      if(err){
        res.json({sonuc:"basarısız"})
        throw err;
      }

      res.status(200).json({sonuc:"basarılı"});
      console.log('yeni blok eklendi');
    })
})

//index numarsı verilen bloğu ver..
app.post("/oneBlock",(req,res)=>{
  Block.findOne({'index':req.body.index}, (err,data)=>{
    if (err) throw err;
    isValidBlock(data).then( r=>{res.json(data)})
    .catch( e=>{res.json({"e":0})})
  })
})


//son blok bilgilerini ver
app.post("/getlastblockdata", (req,res)=>{
  res.json(LastBlockData);
})


// yeni kullanıcı ekle ***
app.post("/newuser", (req, res) => { 
  var user = new User(req.body);

  user.save(function(err) {
    if (err) throw err;

    res.status(200).send(user);
    sendMessageToSocket('yeni kullanıcı eklendi: '+user.userName );
  })
 
  syncUser(user);
});


//diğer serverdan kullanıcı geldiğinde
app.post("/addUser",(req,res)=>{
  var user = new User(req.body);

  user.save(function(err) {
    if (err) throw err;
    sendMessageToSocket('added a user: '+ user.userName );
    res.json({"sonuc":"basarılı"});
  })
})

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
    sendMessageToSocket('car saved. chassis:'+_car.saseNo);
  });
  syncCar(_car);
});

//başka serverdan gelen aracı kaydet..
app.post("/addCar", (req,res)=>{
  let _car = new Car(req.body);

  _car.save(function(err) {
    if (err) throw err;

    res.json({"sonuc":"başarılı"});
  });
})


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







//const server = http.Server(app);
server.listen(8080);
console.log('listening clients on port:8080');



isConnect = false;


io.sockets.on('connection', (socket)=>{

  isConnect = true;
  
  socket.on('disconnect', function(data){
      isConnect = false;
  })

  socket.on('send message',function(data){
       io.sockets.emit('new message', { msg: data, test:'sait'})
  })
})


function sendMessageToSocket(data='listening..'){
  if(isConnect){
      io.sockets.emit('test server', {msg:data});
  }else{
    console.log('socket connection error');
  }
}






//diğer serverlara post göndermek için..
let SendPost = (url,data)=>{
  return new Promise( (resolve,reject)=>{
  axios.post(url,data).then( (res)=>{
    if(res.data.sonuc)
        resolve(res.data.sonuc)
    else if(res.data.index)
        resolve(res.data)
  }).catch( (err)=>{
    reject(err)
  })
  })
}

