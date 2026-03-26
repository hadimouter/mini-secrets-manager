import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  declare email: string;

  @ApiProperty({ example: 'StrongP@ssw0rd' })
  @IsString()
  declare password: string;
}
