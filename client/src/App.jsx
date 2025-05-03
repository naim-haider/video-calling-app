import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("https://video-calling-app-gcom.onrender.com/");

const App = () => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const [roomId, setRoomId] = useState("");
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    socket.on("user-joined", async () => {
      console.log("New user joined the room, creating offer...");
    });

    socket.on("ready", async () => {
      console.log("Remote peer is ready. Creating offer...");
      await createOffer();
    });

    socket.on("offer", async (sdp) => {
      console.log("Received offer, creating answer...");
      await createAnswer(sdp);
    });

    socket.on("answer", async (sdp) => {
      console.log("Received answer");
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(sdp)
      );
    });

    socket.on("ice-candidate", async (candidate) => {
      console.log("Received ICE candidate");
      try {
        await peerConnectionRef.current.addIceCandidate(candidate);
      } catch (error) {
        console.error("Error while adding ICE candidate", error);
      }
    });

    socket.on("call-rejected", () => {
      console.log("Your call was rejected");

      if (localVideoRef.current?.srcObject) {
        localVideoRef.current.srcObject
          .getTracks()
          .forEach((track) => track.stop());
        localVideoRef.current.srcObject = null;
      }

      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      alert("Your call was rejected by the other peer.");
    });

    return () => {
      socket.off("user-joined");
      socket.off("ready");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("call-rejected");
    };
  }, []);

  // craeting peerConnection
  const createPeerConnection = () => {
    const pc = new RTCPeerConnection();
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit("ice-candidate", { roomId, candidate: e.candidate });
      }
    };
    pc.ontrack = (e) => {
      remoteVideoRef.current.srcObject = e.streams[0];
    };
    return pc;
  };

  // creating offer
  const createOffer = async () => {
    if (peerConnectionRef.current) {
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, sdp: offer });
    }
  };

  // creating answer
  const createAnswer = async (offer) => {
    if (!peerConnectionRef.current) {
      peerConnectionRef.current = createPeerConnection();
    }
    const remoteStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideoRef.current.srcObject = remoteStream;
    remoteStream.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, remoteStream);
    });

    await peerConnectionRef.current.setRemoteDescription(
      new RTCSessionDescription(offer)
    );
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);
    socket.emit("answer", { roomId, sdp: answer });
  };

  // start video handler
  const startVideo = async () => {
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    localVideoRef.current.srcObject = localStream;

    peerConnectionRef.current = createPeerConnection();

    localStream.getTracks().forEach((track) => {
      peerConnectionRef.current.addTrack(track, localStream);
    });

    socket.emit("ready", roomId);
  };

  // reject call handler
  const handleRejectCall = () => {
    if (localVideoRef.current?.srcObject) {
      localVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      localVideoRef.current.srcObject = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    socket.emit("reject-call", roomId);
    alert("You rejected the call");
  };

  const joinRoom = () => {
    if (!roomId) return alert("Enter a room ID");
    socket.emit("join", roomId);
    setJoined(true);
  };

  return (
    <div style={{ textAlign: "center", padding: 20 }}>
      <h2>React WebRTC + Socket.IO</h2>

      {!joined ? (
        <div>
          <input
            type="text"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      ) : (
        <>
          <div>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "45%", margin: 5, backgroundColor: "gray" }}
            />
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{ width: "45%", margin: 5, backgroundColor: "gray" }}
            />
          </div>
          <button onClick={startVideo} style={{ margin: 10 }}>
            Start Video
          </button>
          <button
            onClick={handleRejectCall}
            style={{
              margin: 10,
              backgroundColor: "red",
              color: "white",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
            }}
          >
            Reject Call
          </button>
        </>
      )}
    </div>
  );
};

export default App;
