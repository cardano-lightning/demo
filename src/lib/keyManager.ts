import { Buffer } from 'buffer';
import { WalletIndex, deriveNormalSigningKey, fromRecoveryPhrase, KeyIndex, KeyRole, NormalPrivateKey, NormalPublicKey, RootBip32PrivateKey } from './cardanoAddress';
import { Bip32PrivateKey, Ed25519PublicKey, Ed25519Signature } from '@cardano-sdk/crypto';
import { GetPassphrase, InvalidPassphrase, mkSecretManager, Mnemonic, PassphraseGetterError, Secret, SecretManager, Vault } from './secretManager';
import * as secretManager from './secretManager';
import * as cardanoAddress from './cardanoAddress';

export type RootBip32PrivateKeyVault = Vault<"RootBip32PrivateKey">;

export type WithChildKey <result> = (key: NormalPrivateKey) => Promise<result>;

export type WithChildKeys <result> = (key: NormalPrivateKey[]) => Promise<result>;

export type KeyDerivationPath = Readonly<{
  accountIndex: WalletIndex;
  role: KeyRole;
  index: KeyIndex;
}>;

export type KeyInfo = Readonly<{
  publicKey: NormalPublicKey;
  path: KeyDerivationPath;
}>;

export type KeysManagerVault = Readonly<{
  publicKeysInfo: ReadonlySet<KeyInfo>;
  rootVault: RootBip32PrivateKeyVault;
}>;

export type KeysManager = {
  getVault: () => KeysManagerVault;
  derive: <result>(derivationPath: KeyDerivationPath, getPassphrase: GetPassphrase, withChildKey: WithChildKey<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  deriveMany: <result>(derivationPaths: KeyDerivationPath[], getPassphrase: GetPassphrase, withChildKeys: WithChildKeys<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  sign: (derivationPath: KeyDerivationPath, getPassphrase: GetPassphrase, data: Buffer) => Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError>;
  verify: (path: KeyDerivationPath, message: Buffer, signature: Ed25519Signature) => Promise<boolean | KeyNotFound>;
};

export type KeyNotFound = { type: "KeyNotFound", key: KeyDerivationPath | Ed25519PublicKey };
export const keyNotFound = (key: KeyDerivationPath | Ed25519PublicKey): KeyNotFound => ({ type: "KeyNotFound", key });

export const fromVault = (vault: KeysManagerVault) => {
  const rootKeyManager = secretManager.loadVault(vault.rootVault);
  const keys = new Set<KeyInfo>(vault.publicKeysInfo);

  const derive =
    async <result> (path: KeyDerivationPath, getPassphrase: GetPassphrase, withChildKey: WithChildKey<result>): Promise<result | PassphraseGetterError | InvalidPassphrase> => {
      return rootKeyManager.decrypt(getPassphrase, async (secret: Secret): Promise<result> => {
        const rootPrivateKey = Bip32PrivateKey.fromBytes(new Uint8Array(secret)) as RootBip32PrivateKey;
        const derivedPrivateKey = await deriveNormalSigningKey(rootPrivateKey, path.accountIndex, path.role, path.index);
        keys.add({ publicKey: await derivedPrivateKey.toPublic() as NormalPublicKey, path });
        return withChildKey(derivedPrivateKey);
      });
  };

  return {
    getVault: () => {
      return Object.freeze({
        publicKeysInfo: new Set(keys),
        rootVault: vault.rootVault
      });
    },
    derive,
    deriveMany: async <result> (paths: KeyDerivationPath[], getPassphrase: GetPassphrase, withChildKey: WithChildKeys<result>): Promise<result | InvalidPassphrase | PassphraseGetterError> => {
      return rootKeyManager.decrypt(getPassphrase, async (rootPrivateKeyBytes: Secret) => {
        const rootPrivateKey = Bip32PrivateKey.fromBytes(new Uint8Array(rootPrivateKeyBytes)) as RootBip32PrivateKey;
        const derivedPrivateKeys = await Promise.all(paths.map(async (path) => {
          return await deriveNormalSigningKey(rootPrivateKey as RootBip32PrivateKey, path.accountIndex, path.role, path.index)
        }));
        return await withChildKey(derivedPrivateKeys);
      });
    },
    sign: async (path: KeyDerivationPath, getPassphrase: GetPassphrase, data: Buffer): Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError> => {
      return derive(path, getPassphrase, async (privateKey: NormalPrivateKey) => {
        return await cardanoAddress.sign(privateKey, data);
      });
    },
    verify: async (path: KeyDerivationPath, message: Buffer, signature: Ed25519Signature): Promise<boolean | KeyNotFound> => {
      const keyInfo = Array.from(keys).find((keyInfo) => keyInfo.path === path);
      if(keyInfo === undefined) return keyNotFound(path);
      return await cardanoAddress.verify(keyInfo.publicKey, signature, message);
    }
  };
}

export const mkKeysManager = async (mnemonic: Mnemonic, getPassphrase: GetPassphrase): Promise<KeysManager | PassphraseGetterError> => {
  const rootPrivateKeyBytes = Buffer.from(fromRecoveryPhrase(mnemonic).bytes());
  const rootKeyManager = await mkSecretManager(getPassphrase, rootPrivateKeyBytes as Secret);
  if("type" in rootKeyManager &&  rootKeyManager.type === "PassphraseGetterError") return rootKeyManager;
  const rootVault = (rootKeyManager as SecretManager<"RootBip32PrivateKey">).getVault();
  return fromVault({ publicKeysInfo: new Set(), rootVault });
}

// Some handy API extensions
export const signByPublicKey = async (keysManager: KeysManager, publicKey: Ed25519PublicKey, getPassphrase: GetPassphrase, data: Buffer): Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError | KeyNotFound> => {
  // First search for the key and its path
  const keyInfo = Array.from(keysManager.getVault().publicKeysInfo).find((keyInfo) => keyInfo.publicKey === publicKey);
  if(keyInfo === undefined) return keyNotFound(publicKey);
  return keysManager.sign(keyInfo.path, getPassphrase, data);
}
