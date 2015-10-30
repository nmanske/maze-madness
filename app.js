var express = require("express");
var app = express();
var server = require("http").Server(app);
var io = require("socket.io")(server);

app.use(express.static(__dirname + "/public"));

app.get("/", function(req, res){
  res.sendFile("/index.html");
});

var playerCount = 0;
var id = 0;

io.on("connection", function (socket) {
  playerCount++;
  id++;

  setTimeout(function () {
    socket.emit("connected_game", { playerId: id });
    io.emit("count", { playerCount: playerCount });
  }, 1500);

  socket.on("disconnect", function () {
    playerCount--;
    io.emit("count", { playerCount: playerCount });
  });

  socket.on("update", function (data) {
    socket.broadcast.emit("updated", data);
  });
});

server.listen(8080);
console.log("Listening on port 8080");
