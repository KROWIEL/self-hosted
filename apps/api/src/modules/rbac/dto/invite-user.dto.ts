import { RoleName } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString } from "class-validator";

export class InviteUserDto {
  @IsOptional()
  @IsString()
  githubLogin?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsEnum(RoleName)
  roleName!: RoleName;
}
