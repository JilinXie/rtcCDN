var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({port: 9090});


var userdb = {};

var sendMsg = function(peer, msg) {
    userdb[peer].send(JSON.stringify(msg));
}

wss.on('connection', function(connection) {
    connection.on('message', function(msg) {
        msg = JSON.parse(msg);
        debugger;
        switch(msg.operation) {
            case "login":
                userdb[msg.username] = connection;
                connection.send(JSON.stringify({operation: "login",
                                                username: msg.username}));
                console.log(msg.username + ' logged in');
                break;
            case "candidate":
                console.log('candidate from ' + msg.from+ ' to ' + msg.to);
                sendMsg(msg.to, {operation: "candidate",
                                 candidate: msg.candidate,
                                 peer: msg.from});
                break;
            case "offer":
                console.log('offer from ' + msg.from + ' to ' + msg.to);
                sendMsg(msg.to, {operation: "offer",  offer: msg.offer,
                                 peer: msg.from});
                break;
            case "answer":
                console.log('answer from ' + msg.from + ' to ' + msg.peer);
                sendMsg(msg.to, {operation: "answer", answer: msg.answer});
            default:
                break;
        }
    });
    connection.on('close', function() {
        for (let uname in userdb) {
            if (userdb[uname] === connection) {
                delete(userdb[uname]);
            }
        }
    });
});
