import { Injectable, Logger } from "@nestjs/common";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor() {
    this.key = this.loadMasterKey();
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`;
  }

  decrypt(payload: string): string {
    const [ivBase64, authTagBase64, encryptedBase64] = payload.split(".");
    if (!ivBase64 || !authTagBase64 || !encryptedBase64) {
      throw new Error("Invalid encrypted payload format");
    }

    const iv = Buffer.from(ivBase64, "base64");
    const authTag = Buffer.from(authTagBase64, "base64");
    const encrypted = Buffer.from(encryptedBase64, "base64");
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  }

  private loadMasterKey(): Buffer {
    const raw = process.env.MASTER_ENCRYPTION_KEY;
    if (raw) {
      const maybeBase64 = Buffer.from(raw, "base64");
      if (maybeBase64.length === 32) {
        return maybeBase64;
      }
      this.logger.warn("MASTER_ENCRYPTION_KEY is not 32-byte base64, deriving deterministic key.");
      return createHash("sha256").update(raw).digest();
    }

    this.logger.warn(
      "MASTER_ENCRYPTION_KEY is missing. Falling back to deterministic dev key; do not use in production."
    );
    return createHash("sha256").update("dev-master-key").digest();
  }
}
