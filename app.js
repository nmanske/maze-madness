var express = require("express")
var app = express()
var server = require("http").Server(app)
var io = require("socket.io")(server)

app.use("/static", express.static(__dirname + "/static"))
app.use("/node_modules", express.static(__dirname + "/node_modules"))

app.get("/", function(req, res) {
  res.sendFile(__dirname + "/views/splashpage.html")
})

app.get("/game", function(req, res) {
  res.sendFile(__dirname + "/views/game.html")
})

var scoreboard = []
var playerCount = 0
var id = 0

var nicknames = []

// GAME LOGIC

io.on("connection", function(socket) {
  playerCount++
  id++

  /* GAME LOGIC */

  setTimeout(function startGame() {
    socket.emit("connectedGame", {
      playerId: id
    })
    io.emit("count", {
      playerCount: playerCount
    })
  }, 1500)

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
    scoreboard.push({
      playerID: data["playerID"],
      score: data["score"]
    })
    if (scoreboard.length == 22) {
      scoreboard.splice(1, 1)
    }
    refreshScoreboard()
  })

  function refreshScoreboard() {
    io.emit("updatedScoreboard", {
      scoreboard: scoreboard
    })
  }

  setTimeout(function initializeScoreboard() {
    io.emit("updatedScoreboard", {
      scoreboard: scoreboard
    })
  }, 1500)

  /* CHAT LOGIC */

  socket.on("new user", function(data, callback) {
    if (nicknames.indexOf(data) != -1) {
      callback(false)
    } else {
      callback(true)
      socket.nickname = data
      nicknames.push(socket.nickname)
      //io.sockets.emit("changePlayerID", socket.nickname) // <--- pick up from here
    }
  })

  socket.on("send message", function(data) {
    io.sockets.emit("new message", {
      msg: data,
      nick: socket.nickname,
      playerID: id
    })
  })

})

server.listen(8080)
console.log("Listening on http://localhost:8080/")
