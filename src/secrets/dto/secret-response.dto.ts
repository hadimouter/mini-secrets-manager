import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SecretResponseDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty()
  declare name: string;

  // Valeur déchiffrée à la volée — jamais la valeur chiffrée ni l'IV exposés
  @ApiProperty()
  declare value: string;

  @ApiPropertyOptional()
  declare createdBy: string | null;

  @ApiProperty()
  declare createdAt: Date;

  @ApiPropertyOptional()
  declare expiresAt: Date | null;
}
