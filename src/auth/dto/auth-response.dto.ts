import { ApiProperty } from '@nestjs/swagger';

export class AuthResponseDto {
  @ApiProperty()
  declare accessToken: string;

  @ApiProperty({ example: 'viewer' })
  declare role: string;
}
