import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

const PASSWORD_MIN_LENGTH = 12;

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  declare email: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  declare password: string;
}
