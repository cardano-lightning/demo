import * as bip39 from 'bip39';
import type { Tagged } from 'type-fest';
import { Buffer } from 'buffer';

export const crypto = (function getCrypto(): Crypto {
  if (typeof window !== 'undefined' && window.crypto) return window.crypto;
  if (typeof self !== 'undefined' && self.crypto) return self.crypto;
  if (typeof global !== 'undefined' && global.crypto) return global.crypto;
  throw new Error('WebCrypto not available');
})();

// The larger the strength the more secure the wallet
export type MnemonicStrengthInWords = "12-words" | "15-words" | "18-words" | "21-words" | "24-words";
export type MnemomicStrengthInBits = 128 | 160 | 192 | 224 | 256;
export function strengthWordsToBits(strength: MnemonicStrengthInWords = "24-words"): MnemomicStrengthInBits {
  switch (strength) {
    case "12-words":
      return 128;
    case "15-words":
      return 160;
    case "18-words":
      return 192;
    case "21-words":
      return 224;
    case "24-words":
      return 256;
  }
}

export type Mnemonic = Tagged<string, "Mnemonic">;
export function createMnemonic(strength: MnemonicStrengthInWords = "24-words"): Mnemonic {
  const strengthInBits = strengthWordsToBits(strength);
  return bip39.generateMnemonic(strengthInBits) as Mnemonic;
}

export type Salt = Tagged<Buffer, "Salt">;
// Let's use value level error here
export type Passphrase = { type: "Passphrase", value: string };
export type PassphraseGetterError = { type: "PassphraseGetterError", value: any };

export type RawGetPassphrase = () => Promise<string>;
export type GetPassphrase = Tagged<() => Promise<Passphrase | PassphraseGetterError>, "GetPassphrase">
export const mkGetPassphrase = (getPassphrase: RawGetPassphrase): GetPassphrase => {
  return (async (): Promise<Passphrase | PassphraseGetterError> => {
    // generate or retrive salt
    try {
      return { value: await getPassphrase(), type: "Passphrase" };
    } catch (error) {
      return { value: error, type: "PassphraseGetterError" };
    }
  }) as GetPassphrase;
};

// Derived from MDN examples: https://github.com/mdn/dom-examples/blob/main/web-crypto/derive-key/pbkdf2.js#L1
// TODO: Add section to LICENSE file referencing MDN
// Given salt and a passphrase, we can derive a key
const mkKey = async (salt: Salt, getPassphrase: GetPassphrase): Promise<CryptoKey | PassphraseGetterError> => {
  const passphrase:Passphrase | PassphraseGetterError = await getPassphrase();
  if (passphrase.type === "PassphraseGetterError") return passphrase;

  let enc = new TextEncoder();
  const keyMaterial:CryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase.value),
    {name: "PBKDF2"},
    false,
    ["deriveBits", "deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      "name": "PBKDF2",
      salt: salt,
      "iterations": 100000,
      "hash": "SHA-256"
    },
    keyMaterial,
    { "name": "AES-GCM", "length": 256},
    true,
    [ "encrypt", "decrypt" ]
  );
}

// Given salt and a passphrase, we can derive a key
export type Secret = Tagged<Buffer, "Secret">;
export type InitialVector = Tagged<Buffer, "InitialVector">;
export type Encrypted<Content extends PropertyKey> = Tagged<Buffer, "Encrypted" | Content>;
export type Hash<Content extends PropertyKey> = Tagged<{ salt: Salt, hash: Buffer }, "Hash" | Content>;
export type WithSecret<result> = (secret: Secret) => Promise<result>;

// The only missing piece to derive the key and then decrypt the secret is the passhprase.
export type Vault<Content extends PropertyKey> = Tagged<{
  salt: Salt;
  // Please rotate the iv, encrypt and forget the secret.
  iv: InitialVector;
  encrypted: Encrypted<Content>;
  hashed: Hash<Content>;
}, Content>;

export type InvalidPassphrase = { type: "InvalidPassphrase" }
export const invalidPassphrase: InvalidPassphrase = { type: "InvalidPassphrase" };

// Initializes and manages a vault with a secret:
// * Please `secret` value will be mutated and forgotten during the manager initialization
// Passphrase request will be made during initializtion
export type SecretManager<Content extends PropertyKey> = {
  decrypt: <result> (getPassphrase: GetPassphrase, withSecret: WithSecret<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  // Subsequent calls to `getVault` do not rotate `iv` as we don't have access to the passphrase!
  getVault: () => Vault<Content>;
};

// Shared function
const encrypt = async <Content extends PropertyKey>(key: CryptoKey, iv: InitialVector, secret: Secret): Promise<Encrypted<Content>> => {
  const result = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv
    },
    key,
    secret
  ) as Encrypted<Content>;
  return result;
}

const getRandomBuffer = (size: number): Buffer => Buffer.from(crypto.getRandomValues(new Uint8Array(size)));

// WARNING:
// * Be careful to never capture the `secret` in any closure.
// * On the call site to remember to use the above strategy as well.
export const mkVault= async <Content extends PropertyKey> (getPassphrase: GetPassphrase, secret: Secret): Promise<Vault<Content> | PassphraseGetterError> => {

  const salt = getRandomBuffer(16) as Salt;
  const iv = getRandomBuffer(12) as InitialVector;
  const key = await mkKey(salt, getPassphrase);
  if(key.type === "PassphraseGetterError") return key;
  const encrypted = await encrypt(key, iv, secret);
  const hashSalt = getRandomBuffer(16) as Salt;
  const hash = await crypto.subtle.digest("SHA-256", Buffer.concat([hashSalt, secret]));
  const hashed = {
    hash,
    salt: hashSalt
  } as Hash<Content>;
  return { salt, iv, encrypted, hashed } as Vault<Content>;
}

export const loadVault = <Content extends PropertyKey> (orig: Vault<Content>): SecretManager<Content> => {
  let vault: Vault<Content> = {...orig};
  return {
    decrypt: async <result>(getPassphrase: GetPassphrase, withSecret: WithSecret<result>): Promise<result | PassphraseGetterError | InvalidPassphrase> => {
      const key = await mkKey(vault.salt, getPassphrase);
      if(key.type === "PassphraseGetterError") return key;
      let secret;
      try {
        secret = Buffer.from(await crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: vault.iv
          },
          key,
          vault.encrypted
        )) as Secret;
      } catch (error) {
          return invalidPassphrase;
      }
      // Cycle initial vector on each decryption
      const iv = getRandomBuffer(12) as InitialVector;
      const encrypted = await encrypt<Content>(key, iv, secret);
      vault = { ...vault, iv, encrypted };
      return await withSecret(secret);
    },
    getVault: () => vault
  } as SecretManager<Content>;
}

export const mkSecretManager = async <Content extends PropertyKey> (getPassphrase: GetPassphrase, secret: Secret): Promise<SecretManager<Content> | PassphraseGetterError> => {
  let vault = await mkVault(getPassphrase, secret);

  if("type" in vault && vault.type === "PassphraseGetterError") {
    return vault;
  };
  // TypeScript is not smart enough here :-(
  return loadVault(vault as Vault<Content>);
}

