const localVideo = document.getElementById('localVideo');
const remoteVideo = document.getElementById('remoteVideo');
const nextBtn = document.getElementById('nextBtn');

let localStream;
let peerConnection;
let ws;

const config = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

async function start() {
    try {
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localVideo.srcObject = localStream;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

        ws.onmessage = async (message) => {
            const data = JSON.parse(message.data);

            if (data.type === 'waiting') {
                console.log('Searching for a peer...');
            } 
            else if (data.type === 'match') {
                setupPeerConnection(data.role);
            } 
            else if (data.offer) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);
                ws.send(JSON.stringify({ answer: peerConnection.localDescription }));
            } 
            else if (data.answer) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
            } 
            else if (data.candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            else if (data.type === 'peer_disconnected') {
                handlePeerDisconnect();
            }
        };
    } catch (err) {
        alert('يرجى السماح بالوصول للكاميرا والمايكروفون!');
        console.error(err);
    }
}

function setupPeerConnection(role) {
    peerConnection = new RTCPeerConnection(config);

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    peerConnection.ontrack = (event) => {
        remoteVideo.srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ candidate: event.candidate }));
        }
    };

    if (role === 'offer') {
        peerConnection.onnegotiationneeded = async () => {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            ws.send(JSON.stringify({ offer: peerConnection.localDescription }));
        };
    }
}

function handlePeerDisconnect() {
    if (peerConnection) peerConnection.close();
    remoteVideo.srcObject = null;
    console.log('الطرف الآخر غادر المحادثة.');
}

nextBtn.onclick = () => {
    if (peerConnection) peerConnection.close();
    if (ws) ws.close();
    remoteVideo.srcObject = null;
    start();
};

start();
