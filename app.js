var express = require("express");
var http = require("http");
const websocket = require("ws");

var port = process.env.PORT || 3000;
var app = express();

const server = http.createServer(app);

const wss = new websocket.Server({ server });


var splashStats = ( function(){
  var totalGames = 0;
  var ongoingGames = 0;
  var avgTimePerGame = 0;

  return {
    incrementTotalGames: function() {
      totalGames++;
    },
    calculateAvgTime: function(time) {
      avgTimePerGame = ((avgTimePerGame * totalGames) + time) / totalGames;
    },
    incrementOngoingGames: function() {
      ongoingGames++;
    },
    decrementOngoingGames: function() {
      ongoingGames--;
    },
    getTotalGames: function() {
      return totalGames;
    },
    getOngoingGames: function() {
      return ongoingGames;
    },
    getAvgTimePerGame: function() {
      return avgTimePerGame;
    },
  }
})();

// The current game ids to give out
var gameID = 0;
// The current websocket ids to give out
var connID = 0;
// The current game to add players to
var currGame = new Game(gameID++);
// List of the current websocket connections and which game they're assigned to.
var websockets = {};

// On user connection
wss.on("connection", function (ws) {
  console.log("User Connected!");
  let conn = ws;
  conn.id = connID++;
  let player = new Player(conn);

  // Add Player To Game
  let gameAddResult = currGame.addPlayer(player);
  if (gameAddResult == "FULL") {
    currGame = new Game(gameID++);
    let gameAddResult = currGame.addPlayer(player);
    player.setColor(gameAddResult);
  } else {
    player.setColor(gameAddResult);
  }

  websockets[conn.id] = currGame;

  // Give Player Pieces
  let piece1 = new GamePiece(currGame.pieceIDCount, player.color);
  currGame.incrementPieceID();
  player.setPiece1(piece1);
  let piece2 = new GamePiece(currGame.pieceIDCount, player.color);
  currGame.incrementPieceID();
  player.setPiece2(piece2);
  let piece3 = new GamePiece(currGame.pieceIDCount, player.color);
  currGame.incrementPieceID();
  player.setPiece3(piece3);
  let piece4 = new GamePiece(currGame.pieceIDCount, player.color);
  currGame.incrementPieceID();
  player.setPiece4(piece4);

  var toSend = JSON.stringify({
    'event': "PlayerInfo",
    'playerObject': player
  }, (key,value) => {
      if (key=="wsConn") return undefined;
      else return value;
  })

  conn.send(toSend);

  if (currGame.isFull()) {
    currGame.start();
  }

  // When message arrives
  ws.on("message", function (message) {
    console.log("Message Arrived:" + message);
    message = JSON.parse(message);
    var game = websockets[conn.id];
    switch(message.event){
      case 'PieceMoved':
        var pieceNumber = message.pieceNum;
        var pieceColor = message.piece.color;
        var position = message.newPosition;
        var pieceDOMID = message.pieceDOMID;
        game.sendToAll(JSON.stringify({
          'event': 'PieceMoved',
          'pieceNum': pieceNumber,
          'pieceColor': pieceColor,
          'pieceDOMID': pieceDOMID,
          'newPosition': position 
        }));
        game[`${pieceColor}Player`][`piece${pieceNumber}`].setPosition(position);
        switch(pieceColor) {
          case 'green':
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'yellow'
            }));
            break;
          case 'yellow':
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'blue'
            }));
            break;
          case 'blue':
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'red'
            }));
            break;
          default:
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'green'
            }));
            break;
        }
        break;
      case 'DiceRolled':
        // Forward dice value to all players
        game.sendToAll(JSON.stringify({
          'event': 'DiceRolled',
          'number': message.number,
          'color': message.color
        }));
        break;
      case 'PieceFinished':
        var pieceNumber = message.pieceNum;
        var pieceColor = message.piece.color;

        game[`${pieceColor}Player`].incrementFinishedPieces();
        
        var playerList = [game.greenPlayer, game.yellowPlayer, game.bluePlayer, game.redPlayer];
        playerList.sort((a, b) => (a.numFinishedPieces > b.numFinishedPieces) ? 1 : -1);

        var playerQueue = [];
        for (var i = 0; i < playerList.length; i++) {
          playerQueue.push(playerList[i]);
        }

        game.ranking.setPos1(playerQueue.pop().color);
        game.ranking.setPos2(playerQueue.pop().color);
        game.ranking.setPos3(playerQueue.pop().color);
        game.ranking.setPos4(playerQueue.pop().color);

        game.sendToAll(JSON.stringify({
          'event': 'RankingChanged',
          'rankingObj': game.ranking
        }));

        if (game[`${pieceColor}Player`].numFinishedPieces == 4) {
          game.end();
          game[`${pieceColor}Player`].wsConn.send(JSON.stringify({
            'event': 'Victory'
          }));
          game.sendToAll(JSON.stringify({
            'event': 'Loss'
          }));
        }
        break;
      case 'Eaten':
        var eatenPieceDOMID = message.pieceDOMID;
        var eatenPieceColor = message.color;
        var eatenPieceNum = message.pieceNum;

        game.sendToAll(JSON.stringify({
          'event': 'PieceMoved',
          'pieceNum': eatenPieceNum,
          'pieceColor': eatenPieceColor,
          'pieceDOMID': eatenPieceDOMID,
          'newPosition': 0 
        }));

        game[`${eatenPieceColor}Player`][`piece${eatenPieceNum}`].setPosition(position);
        break;
      case 'RolledNoMoves':
        var lastColor = message.lastColor;
        switch(lastColor) {
          case 'green':
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'yellow'
            }));
            break;
          case 'yellow':
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'blue'
            }));
            break;
          case 'blue':
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'red'
            }));
            break;
          default:
            game.sendToAll(JSON.stringify({
              'event': 'TurnChanged',
              'nextPlayer': 'green'
            }));
            break;
        }
    }
  });

  ws.on('close', function(ws) {
    console.log("User disconnected.");
    let game = websockets[conn.id];
    // Check if this is a player leaving
    if (!game.finishedStatus) {
        if (!game.startedStatus) {
          if (game.greenPlayer != null && game.greenPlayer.wsConn.id == conn.id) {
            // Green player left waiting game
            game.greenPlayer = null;
          } else if (game.yellowPlayer != null && game.yellowPlayer.wsConn.id == conn.id) {
            // Yellow player left waiting game
            game.yellowPlayer = null;
          } else if (game.redPlayer != null && game.redPlayer.wsConn.id == conn.id) {
            // Red player left waiting game
            game.redPlayer = null;
          } else {
            // Blue player left waiting game
            game.bluePlayer = null;
          }
        } else {
          if (game.greenPlayer.wsConn.id == conn.id) {
            game.yellowPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.redPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.bluePlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
          } else if (game.redPlayer.wsConn.id == conn.id) {
            game.yellowPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.greenPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.bluePlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
          } else if (game.yellowPlayer.wsConn.id == conn.id) {
            game.bluePlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.greenPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.redPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
          } else {
            game.yellowPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.greenPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
            game.redPlayer.wsConn.send(JSON.stringify({
              'event': "GameTerminated"
            }));
        }
        game.end();
      }
    }
  });

});

app.use(express.static(__dirname + "/public"));

app.set('view engine', 'ejs');

app.use("/game", function (req, res) {
  res.sendFile("game.html", { root: "./public" });
});

app.use("/", function (req, res) {
  res.render('splash.ejs', { totalGamesPlayed: splashStats.getTotalGames(), ongoingGames: splashStats.getOngoingGames(), avgTimePerGame: splashStats.getAvgTimePerGame() });
});

server.listen(port);

// The object constructors

function GamePiece(pieceID, playerColor) {
  this.id = pieceID;
  this.color = playerColor;
  this.position = 0;
  this.justLeft = true;
  if (playerColor == "green") {
    this.prefix = "lb";
  } else if (playerColor == "yellow") {
    this.prefix = "ub";
  } else if (playerColor == "blue") {
    this.prefix = "rb";
  } else {
    this.prefix = "bb";
  }
}

GamePiece.prototype.setPosition = function(newPosition) {
  this.position = newPosition;
}

GamePiece.prototype.makeJustLeftFalse = function() {
  this.justLeft = false;
}

GamePiece.prototype.setPrefix = function(newPrefix) {
  this.prefix = newPrefix;
}

function Ranking(one, two, three, four) {
  this.pos1 = one;
  this.pos2 = two;
  this.pos3 = three;
  this.pos4 = four;
}

Ranking.prototype.setPos1 = function(player) {
  this.pos1 = player;
}

Ranking.prototype.setPos2 = function(player) {
  this.pos2 = player;
}

Ranking.prototype.setPos3 = function(player) {
  this.pos3 = player;
}

Ranking.prototype.setPos4 = function(player) {
  this.pos4 = player;
}

function Player(conn) {
  this.wsConn = conn;
  this.color = null;
  this.piece1 = null;
  this.piece2 = null;
  this.piece3 = null;
  this.piece4 = null;
  this.numFinishedPieces = 0;
  this.prefix = null;
}

Player.prototype.setColor = function(colour) {
  this.color = colour;
  if (colour == "green") {
    this.prefix = "lb";
  } else if (colour == "yellow") {
    this.prefix = "ub";
  } else if (colour == "blue") {
    this.prefix = "rb";
  } else {
    this.prefix = "bb";
  }
}

Player.prototype.setPiece1 = function(piece) {
  this.piece1 = piece;
}

Player.prototype.setPiece2 = function(piece) {
  this.piece2 = piece;
}

Player.prototype.setPiece3 = function(piece) {
  this.piece3 = piece;
}

Player.prototype.setPiece4 = function(piece) {
  this.piece4 = piece;
}

Player.prototype.incrementFinishedPieces = function() {
  this.numFinishedPieces++;
}

function Game(gameID) {
  this.id = gameID;
  this.greenPlayer = null;
  this.yellowPlayer = null;
  this.bluePlayer = null;
  this.redPlayer = null;
  this.finishedStatus = false;
  this.startedStatus = false;
  this.pieceIDCount = 0;
  this.timeStarted = 0;
  this.timeFinished = 0;
  this.ranking = new Ranking("Blue", "Green", "Red", "Yellow");
};

Game.prototype.addPlayer = function(player) {
  if (this.greenPlayer == null) {
    this.greenPlayer = player;
    return "green";
  } else if (this.yellowPlayer == null) {
    this.yellowPlayer = player;
    return "yellow";
  } else if (this.bluePlayer == null) {
    this.bluePlayer = player;
    return "blue";
  } else if (this.redPlayer == null) {
    this.redPlayer = player;
    return "red";
  } else {
    return "FULL";
  }
};

Game.prototype.sendToAll = function(StringifiedJsonToSend) {
  if ((this.greenPlayer != null) && (this.yellowPlayer != null) && (this.bluePlayer != null) && (this.redPlayer != null)) {
    this.greenPlayer.wsConn.send(StringifiedJsonToSend);
    this.yellowPlayer.wsConn.send(StringifiedJsonToSend);
    this.bluePlayer.wsConn.send(StringifiedJsonToSend);
    this.redPlayer.wsConn.send(StringifiedJsonToSend);
  }
}

Game.prototype.start = function() {
  this.startedStatus = true;
  this.timeStarted = Date.now();
  splashStats.incrementOngoingGames();
  this.sendToAll(JSON.stringify({
    'event': 'GameStarted'
  }));
  this.sendToAll(JSON.stringify({
    'event': 'TurnChanged',
    'nextPlayer': 'green'
  }));
}

Game.prototype.end = function() {
  this.finishedStatus = true;
  this.timeFinished = Date.now();
  splashStats.decrementOngoingGames();
  splashStats.incrementTotalGames();
  splashStats.calculateAvgTime(this.timeFinished - this.timeStarted);
}

Game.prototype.incrementPieceID = function() {
  this.pieceIDCount++;
}

Game.prototype.isFull = function() {
  if (this.greenPlayer != null) {
    if (this.yellowPlayer != null) {
      if (this.bluePlayer != null) {
        if (this.redPlayer != null) {
          return true;
        }
      }
    }
  }
  return false;
}