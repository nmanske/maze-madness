window.addEventListener("load", function() {

  // INITIALIZE NEW GAME
  var Q = window.Q = Quintus({
      development: true
    })
    .include("Sprites, Scenes, Input, 2D, Touch, UI")
    .setup("mazeGame")
    .controls()
    .touch();

  var socket = io.connect('http://52.34.113.100:8080');

  Q.gravityX = 0;
  Q.gravityY = 0;

  // COLLISION MASKS
  var SPRITE_PLAYER = 1;
  var SPRITE_ACTOR = 2;
  var SPRITE_TILES = 4;
  var SPRITE_LADDER = 8;
  var SPRITE_SPEED = 16;
  var SPRITE_ENEMY = 32;

  // SPAWN POINTS
  var PLAYER_SPAWN_X = 688;
  var PLAYER_SPAWN_Y = 976;
  var LADDER_SPAWN_X = 688;
  var LADDER_SPAWN_Y = 800;

  // MOVEMENT

  var PLAYER_WALK_SPEED = 200;
  var PLAYER_SPRINT_SPEED = 300;

  // OTHER
  var players = [];
  var UiPlayers = document.getElementById("players");

  /***************************************************************************/
  /*                            GAME CLASSES                                 */
  /***************************************************************************/

  // PLAYER CLASS
  Q.Sprite.extend("Player", {

    init: function(p) {
      this._super(p, {
        type: SPRITE_PLAYER,
        collisionMask: SPRITE_TILES | SPRITE_LADDER | SPRITE_ENEMY | SPRITE_SPEED,
        sprint: false,
        invisible: false,
        sheet: "player"
      });
      this.add("2d, platformerControls");
      this.on("hit.sprite", function(collision) {
        if (collision.obj.isA("Ladder")) {
          Q.stageScene("endGame", 1, {
            label: "You Won!"
          });
          this.p.x = PLAYER_SPAWN_X;
          this.p.y = PLAYER_SPAWN_Y;
        } else if (collision.obj.isA("SpeedVial") && sprint == false /* && vial isn't empty */ ) {
          this.p.speed = PLAYER_SPRINT_SPEED;
          sprint = true;
        } else if (collision.obj.isA("InvisibilityVial") && invisible == false /* && vial isn't empty */ ) {
          this.p.opacity = 0.5;
          this.p.invisible = true;
        }
      });
      Q.input.on("sprint", this, "sprintPlayer");
      Q.input.on("teleport", this, "teleportPlayer");
    },

    sprintPlayer: function() {
      if (this.p.speed == PLAYER_WALK_SPEED) {
        this.p.speed = PLAYER_SPRINT_SPEED;
      } else {
        this.p.speed = PLAYER_WALK_SPEED;
      }
    },

    teleportPlayer: function() {
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
    },

    // Step is called whenever an arrow key is pressed
    step: function(dt) {

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

      this.p.socket.emit("update", {
        playerId: this.p.playerId,
        x: this.p.x,
        y: this.p.y,
        invisible: this.p.invisible,
        sheet: this.p.sheet,
        angle: this.p.angle
      })
    }

  });

  // SPEED VIAL CLASS
  Q.Sprite.extend("SpeedVial", {
    init: function(p) {
      this._super(p, {
        sheet: "speed_vial",
        type: SPRITE_SPEED,
        sensor: true
      });
      this.on("sensor");
    },

    sensor: function() {
      this.p.sheet = "empty_vial";
      //this.destroy();
      var temp = this;
      setTimeout(function() {
        temp.p.sheet = "speed_vial";
      }, 3000);
    }
  });

  // INVISIBILITY VIAL CLASS
  Q.Sprite.extend("InvisibilityVial", {
    init: function(p) {
      this._super(p, {
        sheet: "invisibility_vial",
        type: SPRITE_SPEED,
        sensor: true
      });
      this.on("sensor");
    },

    sensor: function() {
      this.p.sheet = "empty_vial";
      //this.destroy();
      var temp = this;
      setTimeout(function() {
        temp.p.sheet = "invisibility_vial";
      }, 3000);
    }
  });

  // ACTOR CLASS
  Q.Sprite.extend("Actor", {
    init: function(p) {
      this._super(p, {
        sheet: "actor",
        type: SPRITE_ACTOR,
        collisionMask: SPRITE_TILES | SPRITE_ENEMY,
        update: true
      });

      var temp = this;
      setInterval(function() {
        if (!temp.p.update) {
          temp.destroy();
        }
        temp.p.update = false;
      }, 10000);
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
      UiPlayers.innerHTML = "Players: " + data["playerCount"];
    });

    socket.on("connected_game", function(data) {
      selfId = data["playerId"];
      player = new Q.Player({
        playerId: selfId,
        x: PLAYER_SPAWN_X,
        y: PLAYER_SPAWN_Y,
        socket: socket
      });
      stage.insert(player);
      stage.add("viewport").follow(player);
    });

    socket.on("updated", function(data) {
      var actor = players.filter(function(obj) {
        return obj.playerId == data["playerId"];
      })[0];
      if (actor) {
        actor.player.p.x = data["x"];
        actor.player.p.y = data["y"];
        if (data["invisible"] == true) {
          actor.player.p.opacity = 0.0;
        } else {
          actor.player.p.opacity = 1.0;
        }
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

  /***************************************************************************/
  /*                            LEVEL SCENES                                 */
  /***************************************************************************/

  // LEVEL 1 SCENE
  Q.scene("level1", function(stage) {

    stage.collisionLayer(new Q.TileLayer({
      dataAsset: "/static/maps/maze1.json",
      type: SPRITE_TILES,
      collisionMask: SPRITE_PLAYER | SPRITE_ACTOR | SPRITE_ENEMY,
      sheet: "tiles"
    }));
    stage.insert(new Q.Ladder({
      x: LADDER_SPAWN_X,
      y: LADDER_SPAWN_Y
    }));
    stage.insert(new Q.SpeedVial({
      x: 688,
      y: 900
    }));
    stage.insert(new Q.InvisibilityVial({
      x: 800,
      y: 1100
    }))
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
      x: 10,
      y: -10 - button.p.h,
      label: stage.options.label
    }));

    button.on("click", function() {
      Q.clearStage(1);
    });

    container.fit(1000);

  });

  // LOAD GAME ASSETS
  Q.load("/static/images/sprites.png, /static/images/sprites.json, /static/maps/maze1.json, /static/maps/maze2.json, /static/images/tiles.png",
    function() {
      Q.sheet("tiles", "/static/images/tiles.png", {
        tilew: 32,
        tileh: 32
      });
      Q.compileSheets("/static/images/sprites.png", "/static/images/sprites.json");
      Q.stageScene("level1"); // run the game
    });

});
