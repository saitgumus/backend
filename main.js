const express = require("express");
const app = express();
const cors = require('cors');
const bodyParser = require("body-parser");
const dateFormat = require("dateformat");
const moment = require("moment");
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
  'mongodb://node2:nodetest2@ds056549.mlab.com:56549/node-test2',
  'mongodb://nodetest3:nodetest3@ds261116.mlab.com:61116/node-test3'
];

//server veriables
let nodes = [
  //"http://localhost:8080",
  "https://node-test-238108.appspot.com",
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
 mongoose.connect(db_urls[3],{useNewUrlParser:true},err => {
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
  let data = {index:0};

  for(item of nodes){
    await axios.post(item+'/oneBlock', {"index":index})
    .then( r=>{
      if(r.data.index != 0){
        data = r.data;
      }
    }).catch( e=>{console.log(e)})
  }
  return data;
sendMessageToSocket('hatalı block diğer serverlardan alınamadı');

}


//eksik olan bloğu tamamlamak için
let eksikBlokTamamla = async ()=>{
 let dbIndexes;

  await Block.find({},{'index':1,'_id':0},(err,d)=>{
               dbIndexes = d;
            }  ).sort({'index':1})

  if(LastBlockData.index+1 != bs.length){
    for(let i=0; i<bs.length; i++){
      if(i != bs[i]){
        let block =await getOneBlock(i);

            if(block.index != 0){
                block.save( (err)=>{
                if(err) throw err;

              sendMessageToSocket('eksik blok eklendi.')
              console.log('eksik blok eklendi.')
          })
          }else sendMessageToSocket('eksik blok eklenemedi')
      }
    }
    
  }
   
}





//** DİNAMİK İŞLEM SAYISI */

//eğer 1 saniye içerisinde birden fazla istek gelirse isteğe göre dinamik olarak bloğun işlem alma sayısı artacak
let transactionCount = 5;
let oldTime = moment();

let setTransactionCount = ()=>{
  var now = moment();
  var dif = now.diff(oldTime,'seconds');

  if(dif<1){
    if(transactionCount<50)
      transactionCount += 10;
  }else if(dif>0 && dif<5){
      transactionCount = 15
  }else{
    transactionCount = 5
  }
  oldTime = now;
  sendMessageToSocket('her blok için alınacak işlem sayısı güncellendi: '+transactionCount);
}










//// ROUTER BODY /////

app.get('/', (req,res)=>{
  // res.end('hello carchain.. from server-1 -addCar entegre adildi- change /newBlock (version s1 1.1)');
  res.sendFile( __dirname+'/index.html')
})


//yeni işlem ekleme
app.post("/newTransaction", (req, res) => {

  setTransactionCount();

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

  if(testChain.pendingTransactions.length >= transactionCount ){
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
            
            
             // ** hashler kontrolü
            if(data[i].previousHash !== data[i-1].hash )
                 reject(data[i-1]);
            
            //içerik ve hash kontrolü
            if(data[i].hash !== sha256(data[i].index.toString() + data[i].timeStamp + JSON.stringify(data[i].transactions) + data[i].previousHash).toString() )
              {
                reject(data[i]);
              }
            //  console.log('test edildi: '+ data[i-1].index);
          }
          //eksik blok varsa
          if(data.length != i){
            eksikBlokTamamla();
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
      
      new Promise(
        (resolve,reject)=>{
          Block.deleteOne({'index':invalidBlock.index},(err)=>{
            if(err)
              console.log('silme hatası');
          })
          let gblock = getOneBlock(invalidBlock.index);
          if(gblock.index != 0)
            resolve(gblock)
          else reject('blok onarılamadı');
        }
      ).then(
        r =>{
            let newBlock = new Block(r)

            sendMessageToSocket(invalidBlock.index+' index numaralı block onarılıyor');

            newBlock.save( (err)=>{
              if(err){
                console.log('kaydetme sırasında hata..')
                throw err;
              }
              else{
                console.log('blok düzeltildi');
              sendMessageToSocket('onarılma tamamlandı.');
              }
            })

        }
      ).catch(
        e=>{console.log(e)}
      )

      
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

      updateLastBlockData();
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


