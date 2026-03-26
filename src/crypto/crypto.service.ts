import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
// IV de 16 bytes — requis pour AES-256-GCM
const IV_LENGTH = 16;
// Auth tag GCM de 16 bytes — garantit l'intégrité du chiffré
const AUTH_TAG_LENGTH = 16;
// Clé AES-256 = 32 bytes = 64 caractères hexadécimaux
const KEY_HEX_LENGTH = 64;

@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const hexKey = this.configService.getOrThrow<string>('ENCRYPTION_KEY');

    // Validation fail-fast : une clé trop courte affaiblit l'algorithme silencieusement
    if (hexKey.length !== KEY_HEX_LENGTH) {
      throw new Error(
        `ENCRYPTION_KEY must be ${KEY_HEX_LENGTH} hex characters (32 bytes for AES-256)`,
      );
    }

    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Chiffre une valeur en clair avec AES-256-GCM.
   * Un IV aléatoire est généré à chaque appel — deux chiffrements du même texte
   * produisent des sorties différentes (sécurité sémantique).
   *
   * @returns encryptedValue — ciphertext + auth tag (hex), iv — vecteur d'initialisation (hex)
   */
  encrypt(plaintext: string): { encryptedValue: string; iv: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // L'auth tag GCM est concaténé après le ciphertext pour simplifier le stockage
    // Format : ciphertext_hex || authTag_hex (les 32 derniers hex chars = auth tag)
    const authTag = cipher.getAuthTag();
    const encryptedValue = Buffer.concat([ciphertext, authTag]).toString('hex');

    return {
      encryptedValue,
      iv: iv.toString('hex'),
    };
  }

  /**
   * Déchiffre une valeur chiffrée avec AES-256-GCM.
   * L'auth tag est vérifié automatiquement — une exception est levée si les données
   * ont été altérées (tamper-evident).
   */
  decrypt(encryptedValue: string, iv: string): string {
    const data = Buffer.from(encryptedValue, 'hex');

    // Extraire l'auth tag (derniers AUTH_TAG_LENGTH bytes) et le ciphertext
    const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(0, data.length - AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString('utf8');
  }
}
