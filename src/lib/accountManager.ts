import { Ed25519Signature } from '@cardano-sdk/crypto';
import { KeyDerivationPath, KeysManagerVault, mkKeysManager, fromVault as keysManagerFromVault, KeyInfo, RootBip32PrivateKeyVault, KeysManager } from './keyManager';
import { GetPassphrase, InvalidPassphrase, Mnemonic, PassphraseGetterError } from './secretManager';
import { WalletIndex, KeyIndex, KeyRole, SigningKey, VerificationKey } from './signingKeyPair';

export type AccountVault = {
  rootVault: RootBip32PrivateKeyVault;
  accounts: ReadonlyMap<KeyIndex, VerificationKey>;
}

export type WithFreshKey<result> = (key: { ix: KeyIndex, signingKey: SigningKey}) => Promise<result>;

export type AccountManager = {
  deriveFreshAccountKey: <result> (getPassphrase: GetPassphrase, withFreshKey: WithFreshKey<result>) => Promise<result | PassphraseGetterError | InvalidPassphrase>;
  lookupKeyIndex: (verificationKey: VerificationKey) => KeyIndex | AccountNotFound;
  lookupVerificationKey: (keyIndex: KeyIndex) => VerificationKey | AccountNotFound;
  sign: (account: KeyIndex, getPassphrase: GetPassphrase, data: Buffer) => Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError>;
  verify: (account: KeyIndex | VerificationKey, message: Buffer, signature: Ed25519Signature) => Promise<boolean | AccountNotFound>;
  getVault: () => AccountVault;
}

export namespace AccountManager {
  export const ACCOUNT_ID = 0 as WalletIndex;
  export const KEY_ROLE = KeyRole.External;
};

type AccountNotFound = { type: "AccountNotFound" };
const accountNotFound: AccountNotFound = { type: "AccountNotFound" };

export const mkAccountManager = async (mnemonic: Mnemonic, getPassphrase: GetPassphrase): Promise<AccountManager | PassphraseGetterError> => {
  const keysManager = await mkKeysManager(mnemonic, getPassphrase);
  if ('type' in keysManager) {
    return keysManager;
  }
  return fromVault({ rootVault: keysManager.getVault().rootVault, accounts: new Map() });
}

export const fromVault = (vault: AccountVault): AccountManager => {
  const mkPath = (index: KeyIndex): KeyDerivationPath => ({
    accountIndex: AccountManager.ACCOUNT_ID,
    role: AccountManager.KEY_ROLE,
    index
  });
  // Let's reconstruct keysManager vault first
  const keysManagerVault: KeysManagerVault = {
    verificationKeysInfo: Array.from(vault.accounts).map(([index, verificationKey]) => ({
      verificationKey,
      path: mkPath(index)
    })),
    rootVault: vault.rootVault
  };
  const keysManager:KeysManager = keysManagerFromVault(keysManagerVault);
  const getAccounts = (): Map<KeyIndex, VerificationKey> => {
    // * fetch keys manager vault
    // * grab all the keys which use ACCOUNT_ID and KEY_ROLE
    // * put them into the result
    const accounts = new Map(
      Array.from(keysManager.getVault().verificationKeysInfo)
        .filter((keyInfo: KeyInfo) =>
          keyInfo.path.accountIndex === AccountManager.ACCOUNT_ID && keyInfo.path.role === AccountManager.KEY_ROLE)
        .map((keyInfo: KeyInfo) =>
          [keyInfo.path.index, keyInfo.verificationKey])
    );
    return accounts;
  }

  const lookupKeyIndex = (verificationKey: VerificationKey): KeyIndex | AccountNotFound => {
    const accounts = getAccounts();
    const keyIndex = Array.from(accounts.keys()).find((keyIndex) => {
      const vk = accounts.get(keyIndex);
      if(!vk) return false;
      return VerificationKey.equal(vk, verificationKey);
    });
    return keyIndex === undefined ? accountNotFound : keyIndex;
  }

  return {
    deriveFreshAccountKey: async <result> (getPassphrase: GetPassphrase, withFreshKey: WithFreshKey<result>): Promise<result | PassphraseGetterError | InvalidPassphrase> => {
      const accounts = getAccounts();
      const lastKeyIndex = Math.max(...Array.from(accounts.keys()), -1);
      const newKeyIndex = (lastKeyIndex + 1) as KeyIndex;
      const path = mkPath(newKeyIndex);

      const result = await keysManager.derive(path, getPassphrase, async (signingKey) => {
        return withFreshKey({ ix: newKeyIndex, signingKey });
      });
      return result;
    },
    lookupKeyIndex,
    lookupVerificationKey: (keyIndex: KeyIndex): VerificationKey | AccountNotFound => {
      const accounts = getAccounts();
      const key = accounts.get(keyIndex);
      return key || accountNotFound;
    },
    sign: async (keyIndex: KeyIndex, getPassphrase: GetPassphrase, data: Buffer): Promise<Ed25519Signature | InvalidPassphrase | PassphraseGetterError> => {
      const path = mkPath(keyIndex);
      return keysManager.sign(path, getPassphrase, data);
    },
    verify: async (account: KeyIndex | VerificationKey, message: Buffer, signature: Ed25519Signature): Promise<boolean | AccountNotFound> => {
      const keyIndex = typeof account === 'number' ? account : lookupKeyIndex(account);
      if (!(typeof keyIndex === 'number')) return keyIndex;
      const path = mkPath(keyIndex);
      const result = await keysManager.verify(path, message, signature);
      return typeof result === 'boolean' ? result : accountNotFound;
    },
    getVault: () => ({
      rootVault: vault.rootVault,
      accounts: getAccounts()
    })
  };
}
