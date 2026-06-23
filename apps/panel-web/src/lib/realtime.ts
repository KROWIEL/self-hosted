import { io, type Socket } from "socket.io-client";

import { API_BASE_URL } from "./config";

export const realtimeSocket: Socket = io(`${API_BASE_URL}/ui-realtime`, {
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false
});
