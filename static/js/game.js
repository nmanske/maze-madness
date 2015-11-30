window.addEventListener("load", function() {

  // INITIALIZE NEW GAME
  var Q = window.Q = Quintus({
      development: true
    })
    .include("Sprites, Scenes, Input, 2D, Touch, UI")
    .setup("mazeGame")
    .controls()
    .touch();

  Q.input.keyboardControls({
    X: "warp"
  });

  Q.input.touchControls({
    controls: [
      ['left', '<'],
      ['up', '^'],
      ['down', 'v'],
      ['right', '>'],
      ['warp', 'w']
    ]
  });

  var socket = io.connect('http://localhost:8080');

  Q.gravityX = 0;
  Q.gravityY = 0;

  // COLLISION MASKS
  var SPRITE_PLAYER = 1;
  var SPRITE_ACTOR = 2;
  var SPRITE_TILES = 4;
  var SPRITE_LADDER = 8;
  var SPRITE_BOOST = 16;
  var SPRITE_WARP = 32;

  // SPAWN POINTS
  var PLAYER_SPAWN_X = 688;
  var PLAYER_SPAWN_Y = 976;
  var LADDER_SPAWN_X = 688;
  var LADDER_SPAWN_Y = 800;

  // MOVEMENT
  var PLAYER_WALK_SPEED = 200;
  var PLAYER_SPRINT_SPEED = 300;

  // ITEMS
  var vials = [];

  // UI
  var players = [];
  var UiPlayers = document.getElementById("players");
  var scoreboard = [];
  var UiScoreboard = document.getElementById("scoreboard");
  var highscore = "NONE!";
  var UiHighscore = document.getElementById("highscore");
  var id = "";
  var UiID = document.getElementById("id");
  var runtime = 0;
  var UiRuntime = document.getElementById("runtime");
  var boostTime = 0;
  var UiBoostTime = document.getElementById("boostTime");
  var warpUses = 0;
  var UiWarpUses = document.getElementById("warpUses");

  // MISC
  var thisPlayer;
  var activeGame = true;

  /***************************************************************************/
  /*                            GAME CLASSES                                 */
  /***************************************************************************/

  // PLAYER CLASS
  Q.Sprite.extend("Player", {

    init: function(p) {
      this._super(p, {
        sheet: "player",
        type: SPRITE_PLAYER,
        collisionMask: SPRITE_TILES | SPRITE_LADDER | SPRITE_BOOST | SPRITE_WARP,
        lastscore: "N/A"
      });
      this.add("2d, platformerControls");
      this.on("hit.sprite", function(collision) {
        if (collision.obj.isA("Ladder")) {
          Q.stageScene("endGame", 1, {
            label: "You Conquered The Maze In " + secondsToTime(runtime) + " !"
          });
          this.p.lastscore = runtime;
          this.p.socket.emit("pushScore", {
            playerID: this.p.playerId,
            score: this.p.lastscore
          });
          this.p.x = PLAYER_SPAWN_X;
          this.p.y = PLAYER_SPAWN_Y;
          runtime = 0;
          boostTime = 0;
          warpUses = 0;
          activeGame = false;
        } else if (collision.obj.isA("BoostPad")) {
          boostTime = 8;
        }
      });
      Q.input.on("warp", this, "warpPlayer");

    },

    warpPlayer: function() {
      if (warpUses > 0) {
        warpUses--;
        if (Q.inputs['right'] && Q.inputs['up']) {
          this.p.x += 32;
          this.p.y -= 32;
        } else if (Q.inputs['right'] && Q.inputs['down']) {
          this.p.x += 32;
          this.p.y += 32;
        } else if (Q.inputs['left'] && Q.inputs['down']) {
          this.p.x -= 32;
          this.p.y += 32;
        } else if (Q.inputs['left'] && Q.inputs['up']) {
          this.p.x -= 32;
          this.p.y -= 32;
        } else if (Q.inputs['right']) {
          this.p.x += 32;
        } else if (Q.inputs['down']) {
          this.p.y += 32;
        } else if (Q.inputs['left']) {
          this.p.x -= 32;
        } else if (Q.inputs['up']) {
          this.p.y -= 32;
        }
      }
    },

    // Step is called whenever an arrow key is pressed
    step: function(dt) {

      if (activeGame == false) {
        this.p.speed = 0;
      } else {
        if (boostTime == 0) {
          this.p.speed = PLAYER_WALK_SPEED;
        } else {
          this.p.speed = PLAYER_SPRINT_SPEED;
        }

        // Add up and down movement to platformer controls
        if (Q.inputs['up']) {
          if (this.p.speed == PLAYER_SPRINT_SPEED) {
            this.p.vy = -PLAYER_SPRINT_SPEED;
          } else {
            this.p.vy = -PLAYER_WALK_SPEED;
          }
        } else if (Q.inputs['down']) {
          if (this.p.speed == PLAYER_SPRINT_SPEED) {
            this.p.vy = PLAYER_SPRINT_SPEED;
          } else {
            this.p.vy = PLAYER_WALK_SPEED;
          }
        } else if (!Q.inputs['down'] && !Q.inputs['up']) {
          this.p.vy = 0;
        }

        // Change direction of player sprite based on movement direction
        if (this.p.vx > 0 && this.p.vy < 0) {
          this.p.angle = 45;
        } else if (this.p.vx > 0 && this.p.vy > 0) {
          this.p.angle = 135;
        } else if (this.p.vx < 0 && this.p.vy > 0) {
          this.p.angle = 225;
        } else if (this.p.vx < 0 && this.p.vy < 0) {
          this.p.angle = 315;
        } else if (this.p.vx > 0) {
          this.p.angle = 90;
        } else if (this.p.vy > 0) {
          this.p.angle = 180;
        } else if (this.p.vx < 0) {
          this.p.angle = 270;
        } else if (this.p.vy < 0) {
          this.p.angle = 0;
        }

        this.p.socket.emit("updatePlayer", {
          playerId: this.p.playerId,
          x: this.p.x,
          y: this.p.y,
          sheet: this.p.sheet,
          angle: this.p.angle
        });
      }
    }

  });

  // BOOST PAD CLASS
  Q.Sprite.extend("BoostPad", {
    init: function(p) {
      this._super(p, {
        sheet: "boost_pad",
        type: SPRITE_BOOST,
        sensor: true
      });
      this.on("sensor");
    },

    sensor: function() {
      var temp = this;
      setTimeout(function() {
        temp.p.sheet = "boost_pad";
      }, 3000);
    }
  });

  Q.Sprite.extend("WarpVial", {
    init: function(p) {
      this._super(p, {
        sheet: "warp_vial",
        type: SPRITE_WARP,
        sensor: true,
        full: true
      });
      this.on("sensor");
    },

    sensor: function() {
      if (this.p.full == true) {
        warpUses++;
        this.p.sheet = "empty_vial";
        this.p.full = false;
      }
    }
  });

  // ACTOR CLASS
  Q.Sprite.extend("Actor", {
    init: function(p) {
      this._super(p, {
        sheet: "actor",
        type: SPRITE_ACTOR,
        collisionMask: SPRITE_TILES,
        update: true
      });

      var temp = this;
      setInterval(function() {
        if (!temp.p.update) {
          temp.destroy();
        }
        temp.p.update = false;
      }, 1000000);
    }
  });

  // LADDER CLASS
  Q.Sprite.extend("Ladder", {
    init: function(p) {
      this._super(p, {
        type: SPRITE_LADDER,
        sheet: "ladder"
      });
    }
  });

  /***************************************************************************/
  /*                       MAIN MULTIPLAYER LOGIC                            */
  /***************************************************************************/

  // MULTIPLAYER SOCKET
  function setUp(stage) {

    socket.on("count", function(data) {
      if (thisPlayer != undefined) {
        UiPlayers.innerHTML = "Players - " + data["playerCount"];
      }
    });

    socket.on("connectedGame", function(data) {
      selfId = data["playerId"];
      thisPlayer = new Q.Player({
        playerId: selfId,
        x: PLAYER_SPAWN_X,
        y: PLAYER_SPAWN_Y,
        socket: socket
      });
      stage.insert(thisPlayer);
      stage.add("viewport").follow(thisPlayer);
      UiID.innerHTML = "ID - " + selfId;
      runtime = 0;
    });

    socket.on("updatedActor", function(data) {
      var actor = players.filter(function(obj) {
        return obj.playerId == data["playerId"];
      })[0];
      if (actor) {
        actor.player.p.x = data["x"];
        actor.player.p.y = data["y"];
        actor.player.p.angle = data["angle"];
        actor.player.p.sheet = "actor";
        actor.player.p.update = true;
      } else {
        var temp = new Q.Actor({
          playerId: data["playerId"],
          x: data["x"],
          y: data["y"],
          sheet: "actor"
        });
        players.push({
          player: temp,
          playerId: data["playerId"]
        });
        stage.insert(temp);
      }
    });

  }

  socket.on("updatedScoreboard", function(data) {
    scoreboard = data["scoreboard"];
    var fullScoreboard = "<b>[[Scoreboard]]</b><br>";
    var highestscore;
    var highestplayer;
    for (i = 0; i < scoreboard.length; i++) {
      fullScoreboard += "Player " + scoreboard[i].playerID + " - " + secondsToTime(scoreboard[i].score) + "<br>";
      if (scoreboard[i].score < highestscore || highestscore == null) {
        highestplayer = scoreboard[i].playerID;
        highestscore = scoreboard[i].score;
      }
    }
    if (thisPlayer != undefined) {
      UiScoreboard.innerHTML = fullScoreboard;
      if (scoreboard.length > 0) {
        UiHighscore.innerHTML = "<b>[[High Score]]</b><br>" + highestplayer + " - " + secondsToTime(highestscore);
      }
      else {
        UiHighscore.innerHTML = "There's no high score!"
      }
    }
  });

  function secondsToTime(seconds) {
    return (new Date(seconds * 1000)).toUTCString().match(/(\d\d:\d\d:\d\d)/)[0].substring(3);
  }

  setInterval(function addRuntime() {
    if (activeGame == true) {
      runtime++;
    }
  }, 1000);

  setInterval(function subtractBoostTime() {
    if (boostTime > 0) {
      boostTime--;
    }
  }, 1000);

  setInterval(function updateRuntime() {
    if (thisPlayer != undefined) {
      UiRuntime.innerHTML = "Time - " + secondsToTime(runtime);
    }
  }, 10);

  setInterval(function updateBoostTime() {
    if (thisPlayer != undefined) {
      UiBoostTime.innerHTML = "Boost - " + boostTime;
    }
  }, 10);

  setInterval(function updateWarpUses() {
    if (thisPlayer != undefined) {
      UiWarpUses.innerHTML = "Warp (Press X) - " + warpUses;
    }
  }, 10);

  /***************************************************************************/
  /*                            LEVEL SCENES                                 */
  /***************************************************************************/

  // LEVEL 1 SCENE
  Q.scene("level1", function(stage) {

    stage.collisionLayer(new Q.TileLayer({
      dataAsset: "/static/maps/maze1.json",
      type: SPRITE_TILES,
      collisionMask: SPRITE_PLAYER | SPRITE_ACTOR,
      sheet: "tiles"
    }));
    stage.insert(new Q.Ladder({
      x: LADDER_SPAWN_X,
      y: LADDER_SPAWN_Y
    }));
    stage.insert(new Q.BoostPad({
      x: 688,
      y: 900
    }));
    vials.push(new Q.WarpVial({
        x: 800,
        y: 1100
      }),
      new Q.WarpVial({
        x: 700,
        y: 1100
      }),
      new Q.WarpVial({
        x: 600,
        y: 1100
      }));
    stage.insert(vials[0]);
    stage.insert(vials[1]);
    stage.insert(vials[2]);
    setUp(stage);

  });

  // END GAME SCENE
  Q.scene("endGame", function(stage) {

    var container = stage.insert(new Q.UI.Container({
      x: Q.width / 2,
      y: Q.height / 2,
      fill: "rgba(0,0,0,1)"
    }));

    var button = container.insert(new Q.UI.Button({
      x: 0,
      y: 0,
      fill: "#CCCCCC",
      label: "Play Again"
    }))

    var label = container.insert(new Q.UI.Text({
      x: 0,
      y: -50 - button.p.h,
      label: stage.options.label,
      color: "white"
    }));

    button.on("click", function() {
      for (i = 0; i < vials.length; i++) {
        vials[i].p.full = true;
        vials[i].p.sheet = "warp_vial";
      }
      activeGame = true;
      Q.clearStage(1);
    });

    container.fit(1000);

  });

  // LOAD GAME ASSETS
  Q.load("/static/images/sprites.png, /static/images/sprites.json, /static/maps/maze1.json, /static/images/tiles.png",
    function() {
      Q.sheet("tiles", "/static/images/tiles.png", {
        tilew: 32,
        tileh: 32
      });
      Q.compileSheets("/static/images/sprites.png", "/static/images/sprites.json");
      Q.stageScene("level1"); // run the game
    });

});
