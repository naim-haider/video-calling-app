import express from "express";
import http from "http";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  console.log("new user connected: ", socket.id);

  socket.on("join", (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit("user-joined", socket.id);
  });

  socket.on("offer", (data) => {
    socket.to(data.roomId).emit("offer", data.sdp);
  });

  socket.on("answer", (data) => {
    socket.to(data.roomId).emit("answer", data.sdp);
  });

  socket.on("disconnect", () => {
    console.log("user disconnected: ", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Signaling server running on port 5000");
});
