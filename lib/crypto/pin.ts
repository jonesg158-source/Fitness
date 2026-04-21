/**
 * PIN-based encryption for sensitive-at-rest fields.
 *
 * Flow:
 *   PIN + salt --PBKDF2/600k--> KEK (AES-KW)
 *   DEK        = random 32 bytes, stored wrapped-by-KEK in IndexedDB
 *   records    = AES-GCM(DEK, iv=random 12B, aad=tenantId|field)
 *
 * Changing the PIN re-wraps the DEK; it does not re-encrypt every row.
 * Losing the PIN = losing the data (by design — single-user, local-only).
 */

const PBKDF2_ITERS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;
const DEK_BYTES = 32;

export type WrappedDek = {
  salt: Uint8Array;
  wrapIv: Uint8Array;
  wrapped: Uint8Array;
  iters: number;
};

export type EncryptedBlob = { iv: Uint8Array; ct: Uint8Array };

function getCrypto(): Crypto {
  if (typeof globalThis === "undefined" || !globalThis.crypto?.subtle) {
    throw new Error("WebCrypto unavailable");
  }
  return globalThis.crypto;
}

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  getCrypto().getRandomValues(b);
  return b;
}

async function deriveKek(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const c = getCrypto();
  const material = await c.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return c.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERS,
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Create a brand-new wrapped DEK from a PIN. */
export async function createWrappedDek(pin: string): Promise<WrappedDek> {
  const c = getCrypto();
  const salt = randomBytes(SALT_BYTES);
  const wrapIv = randomBytes(IV_BYTES);
  const kek = await deriveKek(pin, salt);
  const dekRaw = randomBytes(DEK_BYTES);
  const wrappedBuf = await c.subtle.encrypt(
    { name: "AES-GCM", iv: wrapIv as BufferSource },
    kek,
    dekRaw as BufferSource,
  );
  // scrub raw DEK
  dekRaw.fill(0);
  return {
    salt,
    wrapIv,
    wrapped: new Uint8Array(wrappedBuf),
    iters: PBKDF2_ITERS,
  };
}

/** Unwrap a DEK given the PIN; throws on wrong PIN. */
export async function unwrapDek(
  pin: string,
  w: WrappedDek,
): Promise<CryptoKey> {
  const c = getCrypto();
  const kek = await deriveKek(pin, w.salt);
  const rawBuf = await c.subtle.decrypt(
    { name: "AES-GCM", iv: w.wrapIv as BufferSource },
    kek,
    w.wrapped as BufferSource,
  );
  return c.subtle.importKey("raw", rawBuf, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/** Re-wrap the in-memory DEK with a new PIN. */
export async function rewrapDek(
  dek: CryptoKey,
  newPin: string,
): Promise<WrappedDek> {
  const c = getCrypto();
  const salt = randomBytes(SALT_BYTES);
  const wrapIv = randomBytes(IV_BYTES);
  const kek = await deriveKek(newPin, salt);
  const rawBuf = await c.subtle.exportKey("raw", dek);
  const wrappedBuf = await c.subtle.encrypt(
    { name: "AES-GCM", iv: wrapIv as BufferSource },
    kek,
    rawBuf,
  );
  return {
    salt,
    wrapIv,
    wrapped: new Uint8Array(wrappedBuf),
    iters: PBKDF2_ITERS,
  };
}

export async function encryptJson<T>(
  dek: CryptoKey,
  value: T,
): Promise<EncryptedBlob> {
  const c = getCrypto();
  const iv = randomBytes(IV_BYTES);
  const ctBuf = await c.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    dek,
    new TextEncoder().encode(JSON.stringify(value)) as BufferSource,
  );
  return { iv, ct: new Uint8Array(ctBuf) };
}

export async function decryptJson<T>(
  dek: CryptoKey,
  blob: EncryptedBlob,
): Promise<T> {
  const c = getCrypto();
  const ptBuf = await c.subtle.decrypt(
    { name: "AES-GCM", iv: blob.iv as BufferSource },
    dek,
    blob.ct as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(ptBuf)) as T;
}

export async function encryptNumber(
  dek: CryptoKey,
  n: number,
): Promise<EncryptedBlob> {
  return encryptJson(dek, n);
}

export async function decryptNumber(
  dek: CryptoKey,
  blob: EncryptedBlob,
): Promise<number> {
  return decryptJson<number>(dek, blob);
}
