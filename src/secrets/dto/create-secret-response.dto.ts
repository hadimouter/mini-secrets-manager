import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Réponse de création — la valeur n'est pas retournée :
// l'appelant vient de l'envoyer, il la connaît déjà.
// Réduire la surface d'exposition des données sensibles en transit.
export class CreateSecretResponseDto {
  @ApiProperty()
  declare id: string;

  @ApiProperty()
  declare name: string;

  @ApiPropertyOptional()
  declare createdBy: string | null;

  @ApiProperty()
  declare createdAt: Date;

  @ApiPropertyOptional()
  declare expiresAt: Date | null;
}
