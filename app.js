var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));

app.get('/', function(req, res){
  res.sendFile('/index.html');
});

server.listen(8080);
console.log("Listening on port 8080");
