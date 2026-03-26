import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Type interne — l'IV est nécessaire pour le déchiffrement mais ne doit jamais
// quitter le service (non exposé dans SecretResponseDto)
export interface SecretRecord {
  id: string;
  name: string;
  value: string; // chiffré AES-256-GCM
  iv: string; // vecteur d'initialisation — séparé de value
  createdBy: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface CreateSecretData {
  name: string;
  value: string; // chiffré avant d'arriver ici
  iv: string;
  createdBy: string;
  expiresAt: Date | null;
}

// Select explicite — l'IV est inclus pour usage interne, jamais exposé en réponse
const SECRET_SELECT = {
  id: true,
  name: true,
  value: true,
  iv: true,
  createdBy: true,
  createdAt: true,
  expiresAt: true,
} as const;

@Injectable()
export class SecretsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSecretData): Promise<SecretRecord> {
    return this.prisma.secret.create({
      select: SECRET_SELECT,
      data: {
        name: data.name,
        value: data.value,
        iv: data.iv,
        createdBy: data.createdBy,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findById(id: string): Promise<SecretRecord | null> {
    return this.prisma.secret.findUnique({
      select: SECRET_SELECT,
      where: { id },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.secret.delete({ where: { id } });
  }
}
