
function trace(msg) {
    var now = (window.performance.now()/1000).toFixed(3);
    console.log(now + ': ', msg);
}

function forceChosenAudioCodec(sdp) {
  return maybePreferCodec(sdp, 'audio', 'send', 'opus');
}

// Copied from AppRTC's sdputils.js:

// Sets |codec| as the default |type| codec if it's present.
// The format of |codec| is 'NAME/RATE', e.g. 'opus/48000'.
function maybePreferCodec(sdp, type, dir, codec) {
  var str = type + ' ' + dir + ' codec';
  if (codec === '') {
    trace('No preference on ' + str + '.');
    return sdp;
  }

  trace('Prefer ' + str + ': ' + codec);

  var sdpLines = sdp.split('\r\n');

  // Search for m line.
  var mLineIndex = findLine(sdpLines, 'm=', type);
  if (mLineIndex === null) {
    return sdp;
  }

  // If the codec is available, set it as the default in m line.
  var codecIndex = findLine(sdpLines, 'a=rtpmap', codec);
  console.log('codecIndex', codecIndex);
  if (codecIndex) {
    var payload = getCodecPayloadType(sdpLines[codecIndex]);
    if (payload) {
      sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], payload);
    }
  }

  sdp = sdpLines.join('\r\n');
  return sdp;
}
function findLine(sdpLines, prefix, substr) {
  return findLineInRange(sdpLines, 0, -1, prefix, substr);
}

// Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
// and, if specified, contains |substr| (case-insensitive search).
function findLineInRange(sdpLines, startLine, endLine, prefix, substr) {
  var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
  for (var i = startLine; i < realEndLine; ++i) {
    if (sdpLines[i].indexOf(prefix) === 0) {
      if (!substr ||
          sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
        return i;
      }
    }
  }
  return null;
}

// Gets the codec payload type from an a=rtpmap:X line.
function getCodecPayloadType(sdpLine) {
  var pattern = new RegExp('a=rtpmap:(\\d+) \\w+\\/\\d+');
  var result = sdpLine.match(pattern);
  return (result && result.length === 2) ? result[1] : null;
}

// Returns a new m= line with the specified codec as the first one.
function setDefaultCodec(mLine, payload) {
  var elements = mLine.split(' ');

  // Just copy the first three parameters; codec order starts on fourth.
  var newLine = elements.slice(0, 3);

  // Put target payload first and copy in the rest.
  newLine.push(payload);
  for (var i = 3; i < elements.length; i++) {
    if (elements[i] !== payload) {
      newLine.push(elements[i]);
    }
  }
  return newLine.join(' ');
}

var localStream;

new Vue({
    el: "#container",
    data: {
        username: '',
        peername: '',
        conn: null,
        rtcConn: null,
        audiotag: null,
    },
    mounted: function() {
        this.audiotag = document.querySelector('audio#audiotag');
        this.connect(); 
        this.rtcConnect();
    },
    methods: {
        sendMsg: function(msg) {
            this.conn.send(JSON.stringify(msg));
        },
        connect: function(method=null) {
            this.conn = new WebSocket('ws://localhost:9090');
            let self = this;
            this.conn.onmessage = function(msg) {
                let data = JSON.parse(msg.data); 
                switch(data.operation) {
                    case "login":
                        console.log('logged in as ' + data.username);
                        break;
                    case "candidate":
                        if (data.candidate != null) {
                            self.rtcConn.addIceCandidate(data.candidate);
                            console.log(self.username + " candidate added");
                        }
                        break;
                    case "offer":
                        console.log("received offer from " + data.peer);
                        self.rtcConn.setRemoteDescription(data.offer)
                            .then(function() {
                                self.rtcConn.createAnswer().then(function(desc) {
                                    self.rtcConn.setLocalDescription(desc)
                                        .then(function() {
                                            desc.sdp = forceChosenAudioCodec(desc.sdp);
                                            console.log("give answer to " + data.peer);
                                            self.sendMsg({operation: "answer",
                                                          answer: desc,
                                                          to: data.peer,
                                                          from: self.username});
                                        }).catch(function(e) { alert('error: ' + ename)});
                                }).catch(function(e) { alert('error: ' + ename)});
                            }).catch(function(e) { alert('error: ' + ename)});
                        console.log("offer accepted from " + data.peer);
                        break;
                    case "answer":
                        self.rtcConn.setRemoteDescription(data.answer);
                        break;
                    case "error":
                        alert(data.msg);
                        break;
                    default:
                        break;
                }
            }
        },
        login: function() {
            this.sendMsg({operation: "login", username: this.username});
        },
        rtcConnect: function() {
            let configuration = { 
               "iceServers": [{ "url": "stun:stun2.1.google.com:19302" }]  
            };
            let self = this;
            this.rtcConn = new RTCPeerConnection(configuration);
            this.rtcConn.onicecandidate = function(e) {
                self.sendMsg({operation: 'candidate',  
                              to: self.peername,
                              from: self.username,                              
                              candidate: e.candidate});
            }
            this.rtcConn.ontrack = function(e) {
                //debugger;
                self.audiotag.srcObject = e.streams[0];
                console.log('Received remote stream');
            }
        },
        peerconnect: function() {
            let self = this;
            navigator.mediaDevices.getUserMedia({audio: true, video: false})
                .then(function(stream) {
                    localStream = stream;
                    var audioTracks = localStream.getAudioTracks();
                    if (audioTracks.length > 0) {
                        trace('Using Audio device: ' + audioTracks[0].label);
                    }
                    localStream.getTracks().forEach(function(track) {
                        let res = self.rtcConn.addTrack(track, localStream);
                        console.log(res);
                    });
                    var offerOptions = { 
                          offerToReceiveAudio: 1,
                          offerToReceiveVideo: 0,
                          voiceActivityDetection: false
                    };
                    self.rtcConn.createOffer(offerOptions).then(function(desc) {
                        self.rtcConn.setLocalDescription(desc).then(function() {
                            desc.sdp = forceChosenAudioCodec(desc.sdp);
                            console.log('send offer to ' + self.peername);
                            self.sendMsg({operation: 'offer',
                                          to: self.peername,
                                          from: self.username,
                                          offer: desc});
                        }).catch(function(e) { alert('error: ' + ename)});
                    }).catch(function(e) {alert('error: ' + e.name)});
                }).catch(function(e) {alert('error: ' + e.name)});
        }
    }
});
