var express = require("express")
var app = express()
var server = require("http").Server(app)
var io = require("socket.io")(server)

app.use("/static", express.static(__dirname + '/static'))
app.use("/node_modules", express.static(__dirname + '/node_modules'))

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/views/splashpage.html")
})

app.get("/game", function(req, res) {
  res.sendFile(__dirname + "/views/game.html")
})

var scoreboard = []
var playerCount = 0
var id = 0

io.on("connection", function(socket) {
  playerCount++
  id++

  setTimeout(function startGame() {
    socket.emit("connectedGame", {
      playerId: id
    })
    io.emit("count", {
      playerCount: playerCount
    })
  }, 1750)

  socket.on("disconnect", function() {
    playerCount--
    io.emit("count", {
      playerCount: playerCount
    })
  })

  socket.on("updatePlayer", function(data) {
    socket.broadcast.emit("updatedActor", data)
  })

  socket.on("pushScore", function(data) {
    scoreboard.push({playerID: data["playerID"], score: data["score"]})
    if (scoreboard.length == 22) {
      scoreboard.splice(1, 1)
    }
  })

  setInterval(function updatedScoreboard() {
    io.emit("updatedScoreboard", {
      scoreboard: scoreboard
    })
  }, 1750)

})

server.listen(8080)
console.log("Listening on http://localhost:8080/")
