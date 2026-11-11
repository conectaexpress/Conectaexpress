import crypto from "crypto";

const SECRET =
  process.env.AUTH_SESSION_SECRET ||
  "conecta_express_enterprise_hmac_secret_2026_production_key";

/**
 * Hash seguro de contraseña con PBKDF2-HMAC-SHA512 y sal criptográfica aleatoria
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = crypto
    .pbkdf2Sync(password, salt, 100000, 64, "sha512")
    .toString("hex");
  return `pbkdf2_sha512$100000$${salt}$${derivedKey}`;
}

/**
 * Verificación en tiempo constante de contraseña frente al hash almacenado
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split("$");
    if (parts.length !== 4 || parts[0] !== "pbkdf2_sha512") {
      return false;
    }
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const originalKey = Buffer.from(parts[3], "hex");
    const derivedKey = crypto.pbkdf2Sync(
      password,
      salt,
      iterations,
      64,
      "sha512"
    );
    if (originalKey.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(originalKey, derivedKey);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  userId: string;
  email: string;
  nombre: string;
  rolCodigo: string;
  rolNombre: string;
  clienteId: string | null;
  transportadorId: string | null;
  exp: number;
}

/**
 * Firma un token de sesión con HMAC-SHA256
 */
export function signSessionToken(payload: Omit<SessionPayload, "exp">): string {
  const ttlHours = Number(process.env.AUTH_SESSION_TTL_HOURS || "12");
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + ttlHours * 3600 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload), "utf8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${signature}`;
}

/**
 * Verifica la firma e integridad temporal del token de sesión
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [encoded, signature] = token.split(".");
    if (!encoded || !signature) return null;
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(encoded)
      .digest("base64url");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as SessionPayload;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Generador de UUID v4 e identificadores consecutivos
 */
export function generateId(): string {
  return crypto.randomUUID();
}
