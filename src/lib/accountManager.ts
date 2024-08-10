import { Ed25519Signature } from '@cardano-sdk/crypto';
import { KeyDerivationPath, keyNotFound, KeyNotFound, KeysManagerVault, mkKeysManager } from './keyManager';
import { GetPassphrase, InvalidPassphrase, Mnemonic, PassphraseGetterError } from './secretManager';
import { WalletIndex, KeyIndex, KeyRole, NormalPrivateKey, NormalPublicKey } from './cardanoAddress';

export type AccountVault = {
  // channels: ReadonlyMap<ChannelId, Readonly<ChannelState>>;
  keysManager: KeysManagerVault;
  accounts: ReadonlyMap<KeyIndex, NormalPublicKey>;
}

export type WithFreshKey<result> = (key: { ix: KeyIndex, privateKey: NormalPrivateKey}) => Promise<result>;

export type AccountManager = {
  deriveFreshAccountKey: <result> (getPassphrase: GetPassphrase, withFreshKey: WithFreshKey<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  lookupKeyIndex: (publicKey: NormalPublicKey) => KeyIndex | AccountNotFound;
  sign: (account: KeyIndex, getPassphrase: GetPassphrase, data: Buffer) => Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError>;
  verify: (account: KeyIndex | NormalPublicKey, message: Buffer, signature: Ed25519Signature) => Promise<boolean | AccountNotFound>;
  publicKey: (keyIndex: KeyIndex) => NormalPublicKey | KeyNotFound;
}

export namespace AccountManager {
  export const ACCOUNT_ID = 1 as WalletIndex;
  export const KEY_ROLE = KeyRole.External;
};

type AccountNotFound = { type: "AccountNotFound" };
const accountNotFound: AccountNotFound = { type: "AccountNotFound" };

export const mkAccountManager = async (mnemonic: Mnemonic, getPassphrase: GetPassphrase): Promise<AccountManager | PassphraseGetterError> => {
  const keysManager = await mkKeysManager(mnemonic, getPassphrase);
  const mkPath = (index: KeyIndex): KeyDerivationPath => ({
    accountIndex: AccountManager.ACCOUNT_ID,
    role: AccountManager.KEY_ROLE,
    index
  });
  if (!('type' in keysManager)) {
    const lookupKeyIndex = (publicKey: NormalPublicKey): KeyIndex | AccountNotFound => {
      const keyInfo = Array.from(keysManager.getVault().publicKeysInfo).find((keyInfo) => keyInfo.publicKey === publicKey);
      if (keyInfo === undefined) return accountNotFound;
      return keyInfo.path.index;
    }

    return {
      deriveFreshAccountKey: async <result> (getPassphrase: GetPassphrase, withFreshKey: WithFreshKey<result>): Promise<result | PassphraseGetterError | InvalidPassphrase> => {
        const lastKeyIndex = Array.from(keysManager.getVault().publicKeysInfo).reduce((maxIndex, keyInfo) => {
          if (keyInfo.path.role === AccountManager.KEY_ROLE && keyInfo.path.accountIndex === AccountManager.ACCOUNT_ID && keyInfo.path.index > maxIndex) {
            return keyInfo.path.index;
          }
          return maxIndex;
        }, 0 as KeyIndex);

        const newKeyIndex = (lastKeyIndex + 1) as KeyIndex;
        const path = mkPath(newKeyIndex);

        return keysManager.derive(path, getPassphrase, async (privateKey) => {
          return withFreshKey({ ix: newKeyIndex, privateKey });
        });
      },
      lookupKeyIndex,
      publicKey: (keyIndex: KeyIndex): NormalPublicKey | KeyNotFound => {
        const keyInfo = Array.from(keysManager.getVault().publicKeysInfo).find((keyInfo) => keyInfo.path.role === AccountManager.KEY_ROLE && keyInfo.path.accountIndex === AccountManager.ACCOUNT_ID && keyInfo.path.index === keyIndex);
        if (keyInfo === undefined) return keyNotFound(mkPath(keyIndex));
        return keyInfo.publicKey;
      },
      sign: async (keyIndex: KeyIndex, getPassphrase: GetPassphrase, data: Buffer): Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError> => {
        const path = mkPath(keyIndex);
        return keysManager.sign(path, getPassphrase, data);
      },
      // If a given key is not found you have to derive it which requires a passphrase.
      verify: async (account: KeyIndex | NormalPublicKey, message: Buffer, signature: Ed25519Signature): Promise<boolean | AccountNotFound> => {
        const keyIndex = typeof account == 'number'? account : lookupKeyIndex(account);
        if ('type' in keyIndex) return keyIndex;
        const path = mkPath(keyIndex);
        const result = keysManager.verify(path, message, signature);
        if (typeof result === 'boolean') {
          return result;
        }
        return accountNotFound;
      }
    };
  };
  // PassphraseGetterError
  return keysManager;
}

