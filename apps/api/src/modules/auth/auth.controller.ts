import { Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { Response } from "express";

import { AuthenticatedRequest } from "../../common/request-user";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get("github/start")
  githubStart(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    const url = this.authService.startGithubAuth(request);
    return response.redirect(url);
  }

  @Get("github/callback")
  async githubCallback(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Query("code") code?: string,
    @Query("state") state?: string
  ) {
    if (!code || !state) {
      return response.status(400).json({ message: "code and state are required" });
    }

    await this.authService.handleGithubCallback(request, code, state);
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
    return response.redirect(frontendUrl);
  }

  @Get("me")
  async me(@Req() request: AuthenticatedRequest) {
    const user = await this.authService.getCurrentUser(request);
    return { user };
  }

  @Post("logout")
  async logout(@Req() request: AuthenticatedRequest, @Res() response: Response) {
    await this.authService.logout(request);
    response.clearCookie("connect.sid");
    return response.json({ success: true });
  }
}
