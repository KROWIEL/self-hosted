import { IsOptional, IsString } from "class-validator";

export class DeployAppDto {
  @IsOptional()
  @IsString()
  gitRef?: string;
}

export class RollbackAppDto {
  @IsOptional()
  @IsString()
  gitRef?: string;
}
