import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateRouteDto {
  @IsString()
  appId!: string;

  @IsString()
  domain!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  targetPort!: number;

  @IsInt()
  @Min(1)
  @Max(65535)
  bindPort!: number;
}

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  targetPort?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  bindPort?: number;
}
