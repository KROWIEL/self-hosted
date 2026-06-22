import { Injectable, Logger } from "@nestjs/common";
import axios from "axios";

interface CaddyRouteInput {
  domain: string;
  bindPort: number;
}

@Injectable()
export class CaddyAdminService {
  private readonly logger = new Logger(CaddyAdminService.name);
  private readonly adminUrl = process.env.CADDY_ADMIN_URL ?? "http://127.0.0.1:2019";

  async syncRoutes(routes: CaddyRouteInput[]) {
    const config = {
      apps: {
        http: {
          servers: {
            selfHosted: {
              listen: [":443"],
              routes: routes.map((route) => ({
                match: [
                  {
                    host: [route.domain]
                  }
                ],
                handle: [
                  {
                    handler: "reverse_proxy",
                    upstreams: [{ dial: `127.0.0.1:${route.bindPort}` }]
                  }
                ]
              }))
            }
          }
        }
      }
    };

    try {
      await axios.post(`${this.adminUrl}/load`, config, {
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      this.logger.error("Failed to sync Caddy routes", error);
      throw error;
    }
  }
}
