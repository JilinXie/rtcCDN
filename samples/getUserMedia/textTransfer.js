'use strict';

let localConnection;
let remoteConnection;
let sendChannel;
let receiveChannel;

const dataChannelSend = document.querySelector('textarea#dataChannelSend');
const dataChannelReceive = document.querySelector('textarea#dataChannelReceive');
const startButton = document.querySelector('button#startButton');
const sendButton = document.querySelector('button#sendButton');
const closeButton = document.querySelector('button#closeButton');


startButton.onclick = createConnection;
sendButton.onclick = sendData;
closeButton.onclick = closeDataChannels;


function createConnection() {
    const servers = null;

    dataChannelSend.placeholder = '';
    localConnection = new RTCPeerConnection(servers);
    sendChannel = localConnection.createDataChannel('sendDataChannel');

    localConnection.onicecandidate = e => {
        onIceCandidate(localConnection, e);
    };

    sendChannel.onopen = onSendChannelStateChange;
    sendChannel.onclose = onSendChannelStateChange;

    
    remoteConnection = new RTCPeerConnection(servers);
    remoteConnection.onicecandidate = e => {
        onIceCandidate(remoteConnection, e);
    }

    remoteConnection.ondatachannel = receiveChannelCallback;

    localConnection.createOffer().then(
        gotDescription1,
        onCreateSessionDescriptionError
    );

    startButton.disabled = true;
    closeButton.disabled = false;
}


function onCreateSessionDescriptionError(error) {
    console.log('Failed to create session description: ' + error.toString());
}


function gotDescription1(desc) {
    localConnection.setLocalDescription(desc);
    remoteConnection.setRemoteDescription(desc);
    remoteConnection.createAnswer().then(
        gotDescription2,
        onCreateSessionDescriptionError
    );
}


function gotDescription2(desc) {
    remoteConnection.setLocalDescription(desc);
    localConnection.setRemoteDescription(desc);
}


function getOtherPc(pc) {
    return (pc === localConnection) ? remoteConnection : localConnection;
}


function getName(pc) {
    return (pc === localConnection) ? 'localPeerConnection': 'remotePeerConnection';
}


function onIceCandidate(pc, event) {
    let otherPc = getOtherPc(pc);

    otherPc.addIceCandidate(event.candidate)
        .then(() => onAddIceCandidateSuccess(pc),
            err => onAddIceCandidateError(pc, err));

    console.log(`${getName(otherPc)} ICE candidate: ${event.candidate ? event.candidate.candidate : '(null)'}`);
}


function onAddIceCandidateSuccess() {
    console.log("AddIceCandidate Success.");
}


function onAddIceCandidateError(pc, error) {
    console.log("AddIceCandidate Error.");
}


function onSendChannelStateChange() {
    const readyState = sendChannel.readyState;
    if (readyState === 'open') {
        dataChannelSend.disabled = false;
        sendButton.disabled = false;
        closeButton.disabled = false;
    } else {
        dataChannelSend.disabled = true;
        sendButton.disabled = true;
        closeButton.disabled = true;
    }
}


function receiveChannelCallback(event) {
    receiveChannel = event.channel;
    receiveChannel.onmessage = onReceiveMessageCallback;
    receiveChannel.onopen = onReceiveChannelStateChange;
    receiveChannel.onclose = onReceiveChannelStateChange;
}


function onReceiveChannelStateChange() {
    const readyState = receiveChannel.readyState;
    console.log(`receiveChannel state: ${readyState}`);
}


function onReceiveMessageCallback(event) {
    dataChannelReceive.value = event.data;
}


function sendData() {
    const data = dataChannelSend.value;
    sendChannel.send(data);
    console.log('send data: ' + data);
}


function closeDataChannels() {
    sendChannel.close();
    receiveChannel.close();
    localConnection.close();
    remoteConnection.close();
    localConnection = null;
    remoteConnection = null;
    startButton.disabled = false;
    sendButton.disabled = true;
    closeButton.disabled = true;
    dataChannelSend.value = '';
    dataChannelReceive.value = '';
    dataChannelSend.disabled = true;

    startButton.disabled = false;
    sendButton.disabled = true;
}
