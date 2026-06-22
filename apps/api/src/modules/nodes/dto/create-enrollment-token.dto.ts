import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateEnrollmentTokenDto {
  @IsString()
  nodeName!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  expiresInMinutes?: number;
}
