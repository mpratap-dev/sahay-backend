import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class StartOtpDto {
  @ApiProperty({ enum: ['sms', 'email'] })
  @IsIn(['sms', 'email'])
  channel!: 'sms' | 'email';

  @ApiProperty({ example: '+919876543210' })
  @IsString()
  destination!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ enum: ['sms', 'email'] })
  @IsIn(['sms', 'email'])
  channel!: 'sms' | 'email';

  @ApiProperty()
  @IsString()
  destination!: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class OauthDto {
  @ApiProperty({ enum: ['google', 'apple'] })
  @IsIn(['google', 'apple'])
  provider!: 'google' | 'apple';

  @ApiProperty()
  @IsString()
  idToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nonce?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class LogoutDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
