import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuditService } from '../audit/audit.service';
import { CryptoService } from '../crypto/crypto.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSecretDto } from './dto/create-secret.dto';
import { SecretRecord, SecretsRepository } from './secrets.repository';
import { SecretsService } from './secrets.service';

const MOCK_USER_ID = 'user-uuid-1234';
const MOCK_SECRET_ID = 'secret-uuid-5678';
const MOCK_IP = '127.0.0.1';
const MOCK_PLAINTEXT = 'my-super-secret-value';
const MOCK_ENCRYPTED = 'deadbeef';
const MOCK_IV = 'cafebabe';

const mockRecord: SecretRecord = {
  id: MOCK_SECRET_ID,
  name: 'MY_SECRET',
  value: MOCK_ENCRYPTED,
  iv: MOCK_IV,
  createdBy: MOCK_USER_ID,
  createdAt: new Date('2026-01-01'),
  expiresAt: null,
};

// Mock du client Prisma passé dans la transaction
const mockTx = {
  secret: {
    create: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  },
  auditLog: {
    create: jest.fn().mockResolvedValue(undefined),
  },
};

describe('SecretsService', () => {
  let service: SecretsService;
  let repository: jest.Mocked<SecretsRepository>;
  let crypto: jest.Mocked<CryptoService>;
  let audit: jest.Mocked<AuditService>;
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    mockTx.secret.create.mockResolvedValue(mockRecord);
    mockTx.secret.delete.mockResolvedValue(undefined);
    mockTx.auditLog.create.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        SecretsService,
        {
          provide: SecretsRepository,
          useValue: {
            findById: jest.fn(),
            create: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: CryptoService,
          useValue: {
            encrypt: jest.fn().mockReturnValue({
              encryptedValue: MOCK_ENCRYPTED,
              iv: MOCK_IV,
            }),
            decrypt: jest.fn().mockReturnValue(MOCK_PLAINTEXT),
          },
        },
        {
          provide: AuditService,
          useValue: { log: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest
              .fn()
              .mockImplementation(
                (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
              ),
          },
        },
      ],
    }).compile();

    service = module.get(SecretsService);
    repository = module.get(SecretsRepository);
    crypto = module.get(CryptoService);
    audit = module.get(AuditService);
    prisma = module.get(PrismaService);
  });

  describe('create', () => {
    const dto: CreateSecretDto = { name: 'MY_SECRET', value: MOCK_PLAINTEXT };

    it('chiffre la valeur avant de la stocker', async () => {
      await service.create(dto, MOCK_USER_ID, MOCK_IP);

      expect(crypto.encrypt).toHaveBeenCalledWith(MOCK_PLAINTEXT);
    });

    it('crée le secret et le log dans une transaction atomique', async () => {
      await service.create(dto, MOCK_USER_ID, MOCK_IP);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.secret.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            value: MOCK_ENCRYPTED,
            iv: MOCK_IV,
            createdBy: MOCK_USER_ID,
          }),
        }),
      );
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE',
            userId: MOCK_USER_ID,
          }),
        }),
      );
    });

    it('ne retourne pas la valeur dans la réponse de création', async () => {
      const result = await service.create(dto, MOCK_USER_ID, MOCK_IP);

      expect(result).not.toHaveProperty('value');
    });

    it("n'expose ni l'IV ni le ciphertext dans la réponse", async () => {
      const result = await service.create(dto, MOCK_USER_ID, MOCK_IP);

      expect(result).not.toHaveProperty('iv');
      expect(result).not.toHaveProperty('value');
    });

    it('passe expiresAt converti en Date si fourni', async () => {
      const expiresAt = '2027-06-01T00:00:00.000Z';
      await service.create({ ...dto, expiresAt }, MOCK_USER_ID, MOCK_IP);

      expect(mockTx.secret.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            expiresAt: new Date(expiresAt),
          }),
        }),
      );
    });

    it('lève BadRequestException si expiresAt est dans le passé', async () => {
      await expect(
        service.create(
          { ...dto, expiresAt: '2020-01-01T00:00:00.000Z' },
          MOCK_USER_ID,
          MOCK_IP,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('lève NotFoundException si le secret nexiste pas', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.findById(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si le secret est expiré', async () => {
      repository.findById.mockResolvedValue({
        ...mockRecord,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(
        service.findById(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('logue ACCESS_DENIED si le secret est expiré', async () => {
      repository.findById.mockResolvedValue({
        ...mockRecord,
        expiresAt: new Date('2020-01-01'),
      });

      await expect(
        service.findById(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow();

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCESS_DENIED',
          secretId: MOCK_SECRET_ID,
        }),
      );
    });

    it('lève NotFoundException si le secret appartient à un autre utilisateur (pas admin)', async () => {
      repository.findById.mockResolvedValue({
        ...mockRecord,
        createdBy: 'autre-user-id',
      });

      await expect(
        service.findById(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('logue ACCESS_DENIED si le secret appartient à un autre utilisateur', async () => {
      repository.findById.mockResolvedValue({
        ...mockRecord,
        createdBy: 'autre-user-id',
      });

      await expect(
        service.findById(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow();

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'ACCESS_DENIED',
          userId: MOCK_USER_ID,
        }),
      );
    });

    it('un admin peut accéder aux secrets des autres utilisateurs', async () => {
      repository.findById.mockResolvedValue({
        ...mockRecord,
        createdBy: 'autre-user-id',
      });

      const result = await service.findById(
        MOCK_SECRET_ID,
        MOCK_USER_ID,
        'admin',
        MOCK_IP,
      );

      expect(result.value).toBe(MOCK_PLAINTEXT);
    });

    it('déchiffre la valeur à la volée', async () => {
      repository.findById.mockResolvedValue(mockRecord);

      const result = await service.findById(
        MOCK_SECRET_ID,
        MOCK_USER_ID,
        'viewer',
        MOCK_IP,
      );

      expect(crypto.decrypt).toHaveBeenCalledWith(MOCK_ENCRYPTED, MOCK_IV);
      expect(result.value).toBe(MOCK_PLAINTEXT);
    });

    it('produit un audit log READ après chaque accès réussi', async () => {
      repository.findById.mockResolvedValue(mockRecord);

      await service.findById(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP);

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'READ', userId: MOCK_USER_ID }),
      );
    });

    it("n'expose pas l'IV dans la réponse", async () => {
      repository.findById.mockResolvedValue(mockRecord);

      const result = await service.findById(
        MOCK_SECRET_ID,
        MOCK_USER_ID,
        'viewer',
        MOCK_IP,
      );

      expect(result).not.toHaveProperty('iv');
    });
  });

  describe('delete', () => {
    it('lève NotFoundException si le secret nexiste pas', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.delete(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève NotFoundException si le secret appartient à un autre utilisateur', async () => {
      repository.findById.mockResolvedValue({
        ...mockRecord,
        createdBy: 'autre-user-id',
      });

      await expect(
        service.delete(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP),
      ).rejects.toThrow(NotFoundException);
    });

    it('supprime le secret et crée le log dans une transaction atomique', async () => {
      repository.findById.mockResolvedValue(mockRecord);

      await service.delete(MOCK_SECRET_ID, MOCK_USER_ID, 'viewer', MOCK_IP);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.secret.delete).toHaveBeenCalledWith({
        where: { id: MOCK_SECRET_ID },
      });
      expect(mockTx.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELETE',
            secretId: MOCK_SECRET_ID,
          }),
        }),
      );
    });
  });
});
