import { Request } from "express";

export interface RequestUser {
  id: string;
  roles: string[];
}

export type AuthenticatedRequest = Request & {
  session: Request["session"] & {
    userId?: string;
    roles?: string[];
  };
};
