import { Buffer } from 'buffer';
import { WalletIndex, deriveSigningKey, fromRecoveryPhrase, KeyIndex, KeyRole, SigningKey, VerificationKey, RootBip32PrivateKey, mkVerificationKey } from './signingKeyPair';
import { Bip32PrivateKey, Ed25519Signature } from '@cardano-sdk/crypto';
import { GetPassphrase, InvalidPassphrase, mkSecretManager, Mnemonic, PassphraseGetterError, Secret, SecretManager, Vault } from './secretManager';
import * as secretManager from './secretManager';
import * as signingKeyPair from './signingKeyPair';
import { Tagged } from 'type-fest';

export type RootBip32PrivateKeyVault = Vault<"RootBip32PrivateKey">;

export type WithChildKey <result> = (key: SigningKey) => Promise<result>;

export type WithChildKeys <result> = (key: SigningKey[]) => Promise<result>;

export type KeyDerivationPath = Readonly<{
  accountIndex: WalletIndex;
  role: KeyRole;
  index: KeyIndex;
}>;

export type KeyId = Tagged<string, "KeyId">;

export namespace KeyDerivationPath {
  export const equal = (a: KeyDerivationPath, b: KeyDerivationPath): boolean => {
    return a.accountIndex === b.accountIndex && a.role === b.role && a.index === b.index;
  }

  export const id = (path: KeyDerivationPath): KeyId => {
    return `${path.accountIndex}#${path.role}#${path.index}` as KeyId;
  }
}

export type KeyInfo = Readonly<{
  verificationKey: VerificationKey;
  path: KeyDerivationPath;
}>;

export type KeysManagerVault = Readonly<{
  verificationKeysInfo: ReadonlyArray<KeyInfo>;
  rootVault: RootBip32PrivateKeyVault;
}>;

export type KeysManager = {
  getVault: () => KeysManagerVault;
  derive: <result>(derivationPath: KeyDerivationPath, getPassphrase: GetPassphrase, withChildKey: WithChildKey<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  deriveMany: <result>(derivationPaths: KeyDerivationPath[], getPassphrase: GetPassphrase, withChildKeys: WithChildKeys<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  sign: (derivationPath: KeyDerivationPath, getPassphrase: GetPassphrase, data: Buffer) => Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError>;
  verify: (path: KeyDerivationPath, message: Buffer, signature: Ed25519Signature) => Promise<boolean | KeyNotFound>;
};

export type KeyNotFound = { type: "KeyNotFound", key: KeyDerivationPath | VerificationKey };
export const keyNotFound = (key: KeyDerivationPath | VerificationKey): KeyNotFound => ({ type: "KeyNotFound", key });

export const fromVault = (vault: KeysManagerVault) => {
  const rootKeyManager = secretManager.loadVault(vault.rootVault);
  const keys: Map<KeyId, KeyInfo> = new Map(vault.verificationKeysInfo.map((keyInfo) => [KeyDerivationPath.id(keyInfo.path), keyInfo]));

  const derive =
    async <result> (path: KeyDerivationPath, getPassphrase: GetPassphrase, withChildKey: WithChildKey<result>): Promise<result | PassphraseGetterError | InvalidPassphrase> => {
      return rootKeyManager.decrypt(getPassphrase, async (secret: Secret): Promise<result> => {
        const rootPrivateKey = Bip32PrivateKey.fromBytes(new Uint8Array(secret)) as RootBip32PrivateKey;
        const signingKey = await deriveSigningKey(rootPrivateKey, path.accountIndex, path.role, path.index);
        keys.set(KeyDerivationPath.id(path), { verificationKey: await mkVerificationKey(signingKey) as VerificationKey, path });
        return withChildKey(signingKey);
      });
  };

  return {
    getVault: () => {
      return Object.freeze({
        verificationKeysInfo: Array.from(keys.values()),
        rootVault: vault.rootVault
      });
    },
    derive,
    deriveMany: async <result> (paths: KeyDerivationPath[], getPassphrase: GetPassphrase, withChildKey: WithChildKeys<result>): Promise<result | InvalidPassphrase | PassphraseGetterError> => {
      return rootKeyManager.decrypt(getPassphrase, async (rootPrivateKeyBytes: Secret) => {
        const rootPrivateKey = Bip32PrivateKey.fromBytes(new Uint8Array(rootPrivateKeyBytes)) as RootBip32PrivateKey;
        const derivedPrivateKeys = await Promise.all(paths.map(async (path) => {
          return await deriveSigningKey(rootPrivateKey as RootBip32PrivateKey, path.accountIndex, path.role, path.index)
        }));
        return await withChildKey(derivedPrivateKeys);
      });
    },
    sign: async (path: KeyDerivationPath, getPassphrase: GetPassphrase, data: Buffer): Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError> => {
      return derive(path, getPassphrase, async (signingKey: SigningKey) => {
        return await signingKeyPair.sign(signingKey, data);
      });
    },
    verify: async (path: KeyDerivationPath, message: Buffer, signature: Ed25519Signature): Promise<boolean | KeyNotFound> => {
      const pathId = KeyDerivationPath.id(path);
      const keyInfo = keys.get(pathId);
      if(keyInfo === undefined) return keyNotFound(path);
      const verified = await signingKeyPair.verify(keyInfo.verificationKey, signature, message);
      return verified;
    }
  };
}

export const mkKeysManager = async (mnemonic: Mnemonic, getPassphrase: GetPassphrase): Promise<KeysManager | PassphraseGetterError> => {
  const rootPrivateKeyBytes = Buffer.from(fromRecoveryPhrase(mnemonic).bytes());
  const rootKeyManager = await mkSecretManager(getPassphrase, rootPrivateKeyBytes as Secret);
  if("type" in rootKeyManager &&  rootKeyManager.type === "PassphraseGetterError") return rootKeyManager;
  const rootVault = (rootKeyManager as SecretManager<"RootBip32PrivateKey">).getVault();
  return fromVault({ verificationKeysInfo: [], rootVault });
}

// This function only looks up given verificatoin key in the vault and doesn't try to derive it.
// When key is found the path is used to derive the actual signing key and sign the data.
export const signByVerificationKey = async (keysManager: KeysManager, verificationKey: VerificationKey, getPassphrase: GetPassphrase, data: Buffer): Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError | KeyNotFound> => {
  // First search for the key and its path
  const keyInfo = Array.from(keysManager.getVault().verificationKeysInfo).find((keyInfo) => keyInfo.verificationKey === verificationKey);
  if(keyInfo === undefined) return keyNotFound(verificationKey);
  return keysManager.sign(keyInfo.path, getPassphrase, data);
}
