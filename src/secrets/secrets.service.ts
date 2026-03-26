import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../crypto/crypto.service';
import { MetricsService } from '../monitoring/metrics.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSecretDto } from './dto/create-secret.dto';
import { CreateSecretResponseDto } from './dto/create-secret-response.dto';
import { SecretResponseDto } from './dto/secret-response.dto';
import { SecretRecord, SecretsRepository } from './secrets.repository';

@Injectable()
export class SecretsService {
  constructor(
    private readonly repository: SecretsRepository,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  async create(
    dto: CreateSecretDto,
    userId: string,
    ipAddress: string | null,
  ): Promise<CreateSecretResponseDto> {
    // Fix 3 — expiresAt doit être dans le futur
    if (dto.expiresAt && new Date(dto.expiresAt) <= new Date()) {
      throw new BadRequestException('expiresAt must be a future date');
    }

    const { encryptedValue, iv } = this.crypto.encrypt(dto.value);

    // Transaction atomique : le secret et son audit log sont créés ensemble
    // ou aucun des deux — on ne peut pas avoir un secret sans trace d'audit
    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.secret.create({
        select: {
          id: true,
          name: true,
          createdBy: true,
          createdAt: true,
          expiresAt: true,
        },
        data: {
          name: dto.name,
          value: encryptedValue,
          iv,
          createdBy: userId,
          expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        },
      });

      await tx.auditLog.create({
        data: { userId, secretId: created.id, action: 'CREATE', ipAddress },
      });

      return created;
    });

    this.metrics.secretsCreated.inc();
    return this.toCreateResponseDto(record);
  }

  async findById(
    id: string,
    userId: string,
    role: string,
    ipAddress: string | null,
  ): Promise<SecretResponseDto> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw new NotFoundException('Secret not found');
    }

    // Fix 2 — tentatives refusées loguées (secret expiré ou mauvais propriétaire)
    if (record.expiresAt !== null && record.expiresAt < new Date()) {
      await this.audit.log({
        userId,
        secretId: id,
        action: 'ACCESS_DENIED',
        ipAddress,
      });
      throw new NotFoundException('Secret not found');
    }

    if (role !== 'admin' && record.createdBy !== userId) {
      await this.audit.log({
        userId,
        secretId: id,
        action: 'ACCESS_DENIED',
        ipAddress,
      });
      throw new NotFoundException('Secret not found');
    }

    const decryptedValue = this.crypto.decrypt(record.value, record.iv);

    await this.audit.log({ userId, secretId: id, action: 'READ', ipAddress });
    this.metrics.secretsRead.inc();

    return this.toResponseDto(record, decryptedValue);
  }

  async delete(
    id: string,
    userId: string,
    role: string,
    ipAddress: string | null,
  ): Promise<void> {
    const record = await this.repository.findById(id);

    if (!record) {
      throw new NotFoundException('Secret not found');
    }

    if (role !== 'admin' && record.createdBy !== userId) {
      await this.audit.log({
        userId,
        secretId: id,
        action: 'ACCESS_DENIED',
        ipAddress,
      });
      throw new NotFoundException('Secret not found');
    }

    // Transaction atomique : audit log EN PREMIER, puis suppression
    // L'audit log doit être créé avant le delete — sinon la FK audit_logs.secret_id
    // est cassée par ON DELETE SET NULL avant qu'on puisse insérer le log DELETE
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({
        data: { userId, secretId: id, action: 'DELETE', ipAddress },
      });
      await tx.secret.delete({ where: { id } });
    });

    this.metrics.secretsDeleted.inc();
  }

  private toCreateResponseDto(record: {
    id: string;
    name: string;
    createdBy: string | null;
    createdAt: Date;
    expiresAt: Date | null;
  }): CreateSecretResponseDto {
    const dto = new CreateSecretResponseDto();
    dto.id = record.id;
    dto.name = record.name;
    dto.createdBy = record.createdBy;
    dto.createdAt = record.createdAt;
    dto.expiresAt = record.expiresAt;
    return dto;
  }

  private toResponseDto(
    record: SecretRecord,
    decryptedValue: string,
  ): SecretResponseDto {
    const dto = new SecretResponseDto();
    dto.id = record.id;
    dto.name = record.name;
    dto.value = decryptedValue;
    dto.createdBy = record.createdBy;
    dto.createdAt = record.createdAt;
    dto.expiresAt = record.expiresAt;
    return dto;
  }
}
