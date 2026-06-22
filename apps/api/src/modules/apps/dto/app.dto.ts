import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested
} from "class-validator";
import { Type } from "class-transformer";

export class AppEnvVarInputDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  value!: string;

  @IsOptional()
  isSecret?: boolean;
}

export class GitCredentialInputDto {
  @IsString()
  type!: "pat" | "ssh_key";

  @IsOptional()
  @IsString()
  username?: string;

  @IsString()
  secret!: string;
}

export class CreateAppDto {
  @IsString()
  nodeId!: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUrl()
  repoUrl!: string;

  @IsString()
  branch!: string;

  @IsString()
  composePath!: string;

  @IsString()
  serviceName!: string;

  @IsOptional()
  @IsUrl()
  healthcheckUrl?: string;

  @IsString()
  @IsNotEmpty()
  cpuLimit!: string;

  @IsString()
  @IsNotEmpty()
  memoryLimit!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppEnvVarInputDto)
  envVars!: AppEnvVarInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GitCredentialInputDto)
  gitCredential?: GitCredentialInputDto;
}

export class UpdateAppDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  repoUrl?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsOptional()
  @IsString()
  composePath?: string;

  @IsOptional()
  @IsString()
  serviceName?: string;

  @IsOptional()
  @IsUrl()
  healthcheckUrl?: string;

  @IsOptional()
  @IsString()
  cpuLimit?: string;

  @IsOptional()
  @IsString()
  memoryLimit?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppEnvVarInputDto)
  envVars?: AppEnvVarInputDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => GitCredentialInputDto)
  gitCredential?: GitCredentialInputDto;
}

export class AppLogsQueryDto {
  @IsOptional()
  @Type(() => Date)
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  to?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
