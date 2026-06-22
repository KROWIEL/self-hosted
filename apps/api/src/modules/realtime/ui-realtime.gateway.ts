import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";

import { RealtimeService } from "./realtime.service";

@WebSocketGateway({
  namespace: "/ui-realtime",
  cors: {
    origin: "*",
    credentials: true
  }
})
export class UiRealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(UiRealtimeGateway.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  afterInit(server: Server): void {
    this.realtimeService.attachUiServer(server);
  }

  handleConnection(client: Socket): void {
    this.logger.log(`UI realtime connected ${client.id}`);
  }
}
