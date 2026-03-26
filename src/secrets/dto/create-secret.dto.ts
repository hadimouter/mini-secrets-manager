import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateSecretDto {
  @ApiProperty({ example: 'DATABASE_URL' })
  @IsString()
  @IsNotEmpty()
  declare name: string;

  @ApiProperty({ example: 'postgresql://user:pass@host/db' })
  @IsString()
  @IsNotEmpty()
  declare value: string;

  // TTL optionnel — un secret sans expiresAt est permanent
  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  declare expiresAt?: string;
}
