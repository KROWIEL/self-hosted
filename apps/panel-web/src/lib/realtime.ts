import { io } from "socket.io-client";

import { API_BASE_URL } from "./config";

export const realtimeSocket = io(`${API_BASE_URL}/ui-realtime`, {
  withCredentials: true,
  transports: ["websocket"],
  autoConnect: false
});
