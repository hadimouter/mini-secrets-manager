import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { CryptoService } from './crypto.service';

// Clé de test valide : 32 bytes = 64 hex chars
const VALID_KEY = 'a'.repeat(64);

function buildService(encryptionKey: string): CryptoService {
  const configService = {
    getOrThrow: (key: string) => {
      if (key === 'ENCRYPTION_KEY') return encryptionKey;
      throw new Error(`Unknown config key: ${key}`);
    },
  } as unknown as ConfigService;

  return new CryptoService(configService);
}

describe('CryptoService', () => {
  let service: CryptoService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CryptoService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => VALID_KEY },
        },
      ],
    }).compile();

    service = module.get(CryptoService);
  });

  describe('constructor', () => {
    it('lève une erreur si ENCRYPTION_KEY fait moins de 64 hex chars', () => {
      expect(() => buildService('a'.repeat(32))).toThrow(
        'ENCRYPTION_KEY must be 64 hex characters',
      );
    });

    it('lève une erreur si ENCRYPTION_KEY fait plus de 64 hex chars', () => {
      expect(() => buildService('a'.repeat(65))).toThrow(
        'ENCRYPTION_KEY must be 64 hex characters',
      );
    });

    it('instancie correctement avec une clé valide de 64 hex chars', () => {
      expect(() => buildService(VALID_KEY)).not.toThrow();
    });
  });

  describe('encrypt', () => {
    it('retourne un encryptedValue et un iv non vides', () => {
      const { encryptedValue, iv } = service.encrypt('my-secret');

      expect(encryptedValue).toBeTruthy();
      expect(iv).toBeTruthy();
    });

    it('retourne des valeurs hexadécimales valides', () => {
      const { encryptedValue, iv } = service.encrypt('my-secret');
      const hexRegex = /^[0-9a-f]+$/;

      expect(encryptedValue).toMatch(hexRegex);
      expect(iv).toMatch(hexRegex);
    });

    it('génère un IV différent à chaque chiffrement (sécurité sémantique)', () => {
      const first = service.encrypt('same-plaintext');
      const second = service.encrypt('same-plaintext');

      expect(first.iv).not.toBe(second.iv);
      expect(first.encryptedValue).not.toBe(second.encryptedValue);
    });

    it("n'expose pas le texte en clair dans la valeur chiffrée", () => {
      const plaintext = 'super-secret-value';
      const { encryptedValue } = service.encrypt(plaintext);

      expect(encryptedValue).not.toContain(plaintext);
      expect(Buffer.from(encryptedValue, 'hex').toString()).not.toContain(
        plaintext,
      );
    });
  });

  describe('decrypt', () => {
    it('déchiffre correctement un texte chiffré (round-trip)', () => {
      const plaintext = 'DATABASE_URL=postgresql://user:pass@host/db';
      const { encryptedValue, iv } = service.encrypt(plaintext);

      expect(service.decrypt(encryptedValue, iv)).toBe(plaintext);
    });

    it('préserve les caractères spéciaux et unicode', () => {
      const plaintext = 'p@$$w0rd!_with_ünïcödé_and_émojis_🔐';
      const { encryptedValue, iv } = service.encrypt(plaintext);

      expect(service.decrypt(encryptedValue, iv)).toBe(plaintext);
    });

    it('préserve les valeurs vides', () => {
      const { encryptedValue, iv } = service.encrypt('');

      expect(service.decrypt(encryptedValue, iv)).toBe('');
    });

    it('lève une exception si le ciphertext est altéré (tamper-evident)', () => {
      const { encryptedValue, iv } = service.encrypt('sensitive');
      // Modifier un byte au milieu du ciphertext invalide l'auth tag GCM
      const tampered =
        encryptedValue.slice(0, 4) + 'ffff' + encryptedValue.slice(8);

      expect(() => service.decrypt(tampered, iv)).toThrow();
    });

    it("lève une exception si l'IV est incorrect", () => {
      const { encryptedValue } = service.encrypt('sensitive');
      const wrongIv = '0'.repeat(32); // IV de 16 bytes en hex = 32 chars

      expect(() => service.decrypt(encryptedValue, wrongIv)).toThrow();
    });
  });
});
