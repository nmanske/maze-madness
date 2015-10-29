window.addEventListener("load", function() {

  // INITIALIZE NEW GAME
  var Q = window.Q = Quintus({ development: true })
      .include("Sprites, Scenes, Input, 2D, Touch, UI")
      .setup("mazeGame")
      .controls()
      .touch();

  // LOAD GAME ASSETS
  Q.load("/images/sprites.png, /images/sprites.json, /maps/maze1.json, /maps/maze2.json, /images/tiles.png",
    function() {
      Q.sheet("tiles", "/images/tiles.png", { tilew: 32, tileh: 32 });
      Q.compileSheets("/images/sprites.png", "/images/sprites.json");
      Q.stageScene("level1"); // run the game
  });

  var players = [];
  var socket = io.connect('http://localhost:8080');
  var UiPlayers = document.getElementById("players");

  Q.gravityX = 0;
  Q.gravityY = 0;

  // COLLISION MASKS
  var SPRITE_PLAYER = 1;
  var SPRITE_ACTOR = 2;
  var SPRITE_TILES = 4;
  var SPRITE_ENEMY = 8;

  // SPAWN POINTS
  var PLAYER_SPAWN_X = 688;
  var PLAYER_SPAWN_Y = 976;
  var LADDER_SPAWN_X = 688;
  var LADDER_SPAWN_Y = 800;

  // MISC
  var isRestartGame;
  var selfId_restart;

  /***************************************************************************/
  /*                            GAME CLASSES                                 */
  /***************************************************************************/

  // PLAYER CLASS
  Q.Sprite.extend("Player", {

    init: function(p) {
      this._super(p, {
        type: SPRITE_PLAYER,
        collisionMask: SPRITE_ENEMY | SPRITE_TILES,
        sheet: "player"
      });
      this.add("2d, stepControls");
      this.on("hit.sprite", function(collision) {
        if(collision.obj.isA("Ladder")) {
          Q.clearStages();
          Q.stageScene("endGame", 1, { label: "You Won!" });
          //this.p.x = PLAYER_SPAWN_X;
          //this.p.y = PLAYER_SPAWN_Y;
        }
      });
    },

    step: function (dt) {
      this.p.socket.emit("update", { playerId: this.p.playerId, x: this.p.x, y: this.p.y, sheet: this.p.sheet })
    }

  });

  // ACTOR CLASS
  Q.Sprite.extend("Actor", {
    init: function (p) {
      this._super(p, {
        sheet: "actor",
        type: SPRITE_ACTOR,
        collisionMask: SPRITE_TILES | SPRITE_ENEMY,
        update: true
      });

      var temp = this;
      setInterval(function () {
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
      this._super(p, { sheet: "ladder" });
    }
  });

  /***************************************************************************/
  /*                       MAIN MULTIPLAYER LOGIC                            */
  /***************************************************************************/

  // MULTIPLAYER SOCKET
  function setUp (stage) {
    socket.on("count", function (data) {
      UiPlayers.innerHTML = "Players: " + data["playerCount"];
    });

    socket.on("connected", function (data) {
      selfId = data["playerId"];
      selfId_restart = selfId;
      player = new Q.Player({ playerId: selfId, x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y, socket: socket });
      stage.insert(player);
      stage.add("viewport").follow(player);
    });

    if (Boolean(isRestartGame)) {
      player = new Q.Player({ playerId: selfId_restart, x: PLAYER_SPAWN_X, y: PLAYER_SPAWN_Y, socket: socket });
      stage.insert(player);
      stage.add("viewport").follow(player);
      isRestartGame = 0;
    }

    socket.on("updated", function (data) {
      var actor = players.filter(function (obj) {
          return obj.playerId == data["playerId"];
        })[0];
      if (actor) {
        actor.player.p.x = data["x"];
        actor.player.p.y = data["y"];
        actor.player.p.sheet = "actor";
        actor.player.p.update = true;
      }
      else {
        var temp = new Q.Actor({ playerId: data["playerId"], x: data["x"], y: data["y"], sheet: "actor" });
        players.push({ player: temp, playerId: data["playerId"] });
        stage.insert(temp);
      }
    });

  }

  /***************************************************************************/
  /*                            LEVEL SCENES                                 */
  /***************************************************************************/

  // LEVEL 1 SCENE
  Q.scene("level1", function (stage) {

    stage.collisionLayer(new Q.TileLayer({dataAsset: "/maps/maze1.json",
        type: SPRITE_TILES, collisionMask: SPRITE_PLAYER | SPRITE_ACTOR | SPRITE_ENEMY, sheet: "tiles" }));
    stage.insert(new Q.Ladder({ x: LADDER_SPAWN_X, y: LADDER_SPAWN_Y }));
    setUp(stage);

  });

  // END GAME SCENE
  Q.scene("endGame",function(stage) {

    var container = stage.insert(new Q.UI.Container({
      x: Q.width/2, y: Q.height/2, fill: "rgba(0,0,0,0.5)"
    }));

    var button = container.insert(new Q.UI.Button({
      x: 0, y: 0, fill: "#CCCCCC", label: "Play Again" }))

    var label = container.insert(new Q.UI.Text({
      x:10, y: -10 - button.p.h, label: stage.options.label }));

    button.on("click",function() {
      Q.clearStage(1);
      isRestartGame = 1;
      Q.stageScene("level1");
    });

    container.fit(20);

  });

});
