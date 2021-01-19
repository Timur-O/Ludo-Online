var socket;

window.onload = function() {
    socket = new WebSocket("ws://localhost");
    socket.onopen = () => {
        console.log("Socket Opened!");
    };
    player = null;
    currPlayerTurn = null;
    timestart = 0;
    turnTimeout = null;
    progressBarInterval = -1;
    won = false;

    // On message recieve
    socket.onmessage = function(event){
        console.log("Message Arrived:" + event.data);
        event = JSON.parse(event.data);
        switch(event.event){
            case 'GameStarted':
                timestart = Date.now();
                setInterval(() => {
                    var curr = Date.now() - timestart;
                    document.getElementById("currGameTime").textContent = toHHMMSS(Math.floor(curr/1000));
                }, 1000);
                document.getElementById('waitingscreen').style.display = 'none';
                break;
            case 'PieceMoved':
                var pieceDOMID = event.pieceDOMID;
                var pieceColor = event.pieceColor;
                var pieceNum = event.pieceNum;
                var newPosition = event.newPosition;

                var pieceElement = document.getElementById(pieceDOMID);

                if (pieceColor == player.color) {
                    player[`piece${pieceNum}`].position = newPosition;
                }

                if (newPosition == 0) {
                    document.getElementById(`${pieceColor}BoardSection`).appendChild(pieceElement);
                } else if (newPosition.substr(newPosition.length-2) == 16) {
                    alert(`One of the ${pieceColor} player's pieces finished!`);
                    pieceElement.style.display = "none";
                } else {    
                    document.getElementById(newPosition).appendChild(pieceElement);
                }
                break;
            case 'DiceRolled':
                document.getElementById(`${event.color}PlayerDice`).textContent = event.number;
                document.getElementById(`${player.color}PlayerDice`).disabled = true;
                if (player.color == event.color) {
                    if (checkPieceValidToMove(player.piece1, event.number)) {
                        makePieceClickable(player.piece1, 1);
                    }
                    if (checkPieceValidToMove(player.piece2, event.number)) {
                        makePieceClickable(player.piece2, 2);
                    }
                    if (checkPieceValidToMove(player.piece3, event.number)) {
                        makePieceClickable(player.piece3, 3);
                    }
                    if (checkPieceValidToMove(player.piece4, event.number)) {
                        makePieceClickable(player.piece4, 4);
                    }
                    if (!checkPieceValidToMove(player.piece1, event.number) && !checkPieceValidToMove(player.piece2, event.number) && !checkPieceValidToMove(player.piece3, event.number) && !checkPieceValidToMove(player.piece4, event.number)) {
                        clearTimeout(turnTimeout);
                        socket.send(JSON.stringify({
                            'event': 'RolledNoMoves',
                            'lastColor': player.color
                        }));
                    }
                }
                break;
            case 'TurnChanged':
                var nextPlayerColor = event.nextPlayer;
                currPlayerTurn = nextPlayerColor;
                document.getElementById("timeLeft").value = 30;
                clearInterval(progressBarInterval);
                progressBarInterval = setInterval(() => {
                    document.getElementById("timeLeft").value = document.getElementById("timeLeft").value - 0.2;
                }, 200);
                
                document.getElementById("timeLeft").style.color = nextPlayerColor; // For IE
                document.getElementById("timeLeft").className = '';
                document.getElementById("timeLeft").classList.add(`${nextPlayerColor}ProgressBar`);

                document.getElementById(`${player.color}PlayerDice`).disabled = true;
                if (currPlayerTurn == player.color) {
                    document.getElementById(`${event.nextPlayer}PlayerDice`).removeAttribute("disabled");
                    clearTimeout(turnTimeout);
                    turnTimeout = setTimeout(function() {
                        socket.send(JSON.stringify({
                            'event': 'RolledNoMoves',
                            'lastColor': player.color
                        }));
                    }, 30000);
                }
                break;
            case 'RankingChanged':
                var rankingObj = event.rankingObj;
                document.getElementById("rank1").textContent = rankingObj.pos1;
                document.getElementById("rank2").textContent = rankingObj.pos2;
                document.getElementById("rank3").textContent = rankingObj.pos3;
                document.getElementById("rank4").textContent = rankingObj.pos4;
                break;
            case 'GameTerminated':
                alert("Player left the game.");
                socket.close();
                window.location.href= 'Splash';
                break;
            case 'Loss':
                if (!won) {
                    alert('We\'re sorry, you lost. Good luck next time!');
                    socket.close();
                    window.location.href = 'Splash';
                }
                break;
            case 'Victory':
                won = true;
                alert('Congrats, you won!');
                socket.close();
                window.location.href = 'Splash';
                break;
            case 'PlayerInfo':
                player = event.playerObject;
                if (player.color == 'green') {
                    alert("You are the green player!");
                } else if (player.color == 'yellow') {
                    alert("You are the yellow player!");
                } else if (player.color == 'red') {
                    alert("You are the red player!");
                } else {
                    alert("You are the blue player!");
                }
                break;
        }
    };

    document.getElementById("yellowPlayerDice").addEventListener('click', function(){
        let result = Math.floor(Math.random() * 6) + 1;
        socket.send(JSON.stringify({
            'event': 'DiceRolled',
            'number': result,
            'color': 'yellow'}));
    })
    document.getElementById("bluePlayerDice").addEventListener('click', function(){
        let result = Math.floor(Math.random() * 6) + 1;
        socket.send(JSON.stringify({
            'event': 'DiceRolled',
            'number': result,
            'color': 'blue'}));
    })
    document.getElementById("redPlayerDice").addEventListener('click', function(){
        let result = Math.floor(Math.random() * 6) + 1;
        socket.send(JSON.stringify({
            'event': 'DiceRolled',
            'number': result,
            'color': 'red'}));
    })
    document.getElementById("greenPlayerDice").addEventListener('click', function(){
        let result = Math.floor(Math.random() * 6) + 1;
        socket.send(JSON.stringify({
            'event': 'DiceRolled',
            'number': result,
            'color': 'green'}));
    })

    // Closes socket and returns to splash
    document.getElementById('returnMenuButton').addEventListener('click', function(){
        socket.close();
        window.location.href = "Splash";
    })

    var pieces = document.getElementsByClassName('piece');

    for (var i = 0; i < pieces.length; i++) {
        pieces[i].addEventListener('click', function(e) {
            movePiece(this);
        });
    }
};

// Source: https://stackoverflow.com/questions/6312993/javascript-seconds-to-time-string-with-format-hhmmss
function toHHMMSS(sec_num) {
    var hours   = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = sec_num - (hours * 3600) - (minutes * 60);

    if (hours   < 10) {hours   = "0"+hours;}
    if (minutes < 10) {minutes = "0"+minutes;}
    if (seconds < 10) {seconds = "0"+seconds;}
    return hours+':'+minutes+':'+seconds;
}

function checkPieceValidToMove(piece, diceNum) {
    var piecePosition = "" + piece.position;
    var numericPosition = parseInt(piecePosition.replace(/[^\d]/g, ''));
    if ((numericPosition == 0) && (diceNum == 6)) {
        return true;
    } else {
        if (numericPosition == 0) {
            return false;
        }
        if (numericPosition == 8) {
            if (piece.justLeft) {
                return true;
            } else {
                return diceNum <= 5;
            }
        }
        if (numericPosition < 12) {
            return true;
        } else {
            return (numericPosition + diceNum) <= 16;
        }
    }
}

function makePieceClickable(piece, pieceNum) {
    document.getElementById(`${piece.color}Piece${pieceNum}`).removeAttribute('disabled');
}

function movePiece(element) {
    clearTimeout(turnTimeout);
    var pieceDOM = element;
    var pieceIdDOM = pieceDOM.id;
    var pieceNum = pieceIdDOM.substr(pieceIdDOM.length-1);
    var pieceObj = player[`piece${pieceNum}`];
    var currPosition = "" + pieceObj.position;
    var numericPosition = parseInt(currPosition.replace(/[^\d]/g, ''));
    var diceNum = parseInt(document.getElementById(`${player.color}PlayerDice`).textContent);
    var newPosition;
    var playerPrefix = player[`piece${pieceNum}`].prefix;
    if ((numericPosition == 0) && (diceNum == 6)) {
        newPosition = playerPrefix + "8";
    } else {
        if (!pieceObj.justLeft && (playerPrefix == player.prefix) && (numericPosition <= 8)) {
            if ((numericPosition + diceNum) >= 9) {
                var newNumericPosition = numericPosition + diceNum + 3;
                newPosition = playerPrefix + newNumericPosition;
            } else {
                newPosition = playerPrefix + (numericPosition + diceNum);
            }
        } else if ((numericPosition < 6) || (numericPosition >= 12)) {
            newPosition = playerPrefix + (numericPosition + diceNum);
        } else {
            var positionPlusDice = 11 - (numericPosition + diceNum);
            if (positionPlusDice < 0) {
                var nextPrefix = null;
                if (playerPrefix == 'ub') {
                    nextPrefix = "rb";
                } else if (playerPrefix == 'rb') {
                    nextPrefix = "bb";
                } else if (playerPrefix == 'bb') {
                    nextPrefix = "lb";
                } else {
                    nextPrefix = "ub";
                }
                newPosition = nextPrefix + Math.abs(positionPlusDice);
                player[`piece${pieceNum}`].prefix = nextPrefix;
            } else {
                newPosition = playerPrefix + (11 - positionPlusDice);
            }
        }
        if (numericPosition == 8 && pieceObj.justLeft) {
            pieceObj.justLeft = false;
        }
    }

    socket.send(JSON.stringify({
        'event': 'PieceMoved',
        'pieceNum': pieceNum,
        'piece': pieceObj,
        'newPosition': newPosition,
        'pieceDOMID': pieceIdDOM
    }));
    var newPositionNumeric = parseInt(newPosition.replace(/[^\d]/g, ''));
    if (newPositionNumeric == 16) {
        socket.send(JSON.stringify({
            'event': 'PieceFinished',
            'pieceNum': pieceNum,
            'piece': pieceObj
        }));
    } else {
        var newPositionChildrenNum = document.getElementById(newPosition).childElementCount;
        if (newPositionChildrenNum > 0) {
            var eatenPieceDOM = document.getElementById(newPosition).childNodes[0];
            var eatenPieceIdDOM = eatenPieceDOM.id;
            var eatenPieceNum = eatenPieceIdDOM.substr(eatenPieceIdDOM.length-1);
            var eatenPieceColor;
            if (eatenPieceIdDOM.indexOf('green') != -1) {
                eatenPieceColor = 'green';
            } else if (eatenPieceIdDOM.indexOf('yellow') != -1) {
                eatenPieceColor = 'yellow';
            } else if (eatenPieceIdDOM.indexOf('blue') != -1) {
                eatenPieceColor = 'blue';
            } else {
                eatenPieceColor = 'red';
            }
            if (eatenPieceColor != pieceObj.color) {
                socket.send(JSON.stringify({
                    'event': 'Eaten',
                    'pieceNum': eatenPieceNum,
                    'color': eatenPieceColor,
                    'pieceDOMID': eatenPieceIdDOM
                }));
            }
        }
    }

    var pieceList = document.getElementsByClassName('piece');
    for (piece of pieceList) {
        piece.disabled = true;
    }
}