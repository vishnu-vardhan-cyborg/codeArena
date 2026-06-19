import { io } from "socket.io-client";

const SOCKET_URL =
  process.env.REACT_APP_SOCKET_URL || "http://localhost:4000";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
});

export const connectSocket = (userId) => {
  if (!userId) {
    return;
  }

  if (!socket.connected) {
    socket.connect();
  }

  socket.emit("user:join", userId);
};

export const joinUserNotificationRoom = connectSocket;

export const joinChatRoom = (roomId) => {
  if (!roomId) {
    return;
  }

  socket.emit("chat:join", { roomId });
};

export const sendChatMessage = (payload) => {
  socket.emit("chat:message", payload);
};

export const createChatGroup = (payload) => {
  socket.emit("chat:group:create", payload);
};
