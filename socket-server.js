var express = require('express')
var app = express()
var server = require('http').createServer(app)
var io = require('socket.io').listen(server)

testData = 'try server to client send a data ;)';
isConnect = false;

// server.listen(3000);
// console.log('listening..')


// app.get('/', (req,res)=>{
//     res.sendFile( __dirname+'/index.html')
// })


io.sockets.on('connection', (socket)=>{

    isConnect = true;
    socket.on('disconnect', function(data){
        isConnect = false;
    })

    socket.on('send message',function(data){
 //       io.sockets.emit('new message', { msg: data, test:'sait'})
    })
})


 function test(){
    if(isConnect){
        io.sockets.emit('test server', {msg:testData});
    }
}

