import { Buffer } from 'buffer';
import { KeyIndex, VerificationKey } from '../../src/lib/signingKeyPair';
import { GetPassphrase, invalidPassphrase, mkGetPassphrase, Mnemonic } from '../../src/lib/secretManager';
import { AccountManager, mkAccountManager, fromVault } from '../../src/lib/accountManager';
import * as bip39 from 'bip39';
import { Ed25519Signature } from '@cardano-sdk/crypto';

describe('AccountManager', () => {
  let accountManager: AccountManager;
  const testPassphrase = 'test-passphrase';
  const getPassphrase: GetPassphrase = mkGetPassphrase(async () => testPassphrase);
  const testMnemonic: Mnemonic = bip39.generateMnemonic(256) as Mnemonic;

  beforeAll(async () => {
    const result = await mkAccountManager(testMnemonic, getPassphrase);
    if ('type' in result && result.type === 'PassphraseGetterError') {
      throw new Error('Failed to create account manager');
    }
    accountManager = result as AccountManager;
  });

  test('AccountManager creation and initialization', () => {
    expect(accountManager).toBeDefined();
    expect(accountManager.getVault()).toBeDefined();
  });

  test('Derive fresh account key', async () => {
    const result = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix, signingKey }) => {
      expect(ix).toBe(0);
      expect(signingKey).toBeDefined();
      return true;
    });
    expect(result).toBe(true);
  });

  test('Lookup key index and verification key', async () => {
    const derivationResult = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix, signingKey }) => {
      return { ix, verificationKey: await signingKey.toPublic() as VerificationKey };
    });

    if (typeof derivationResult === 'boolean' || 'type' in derivationResult) {
      throw new Error('Derivation failed');
    }

    const derivationResult2 = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix, signingKey }) => {
      return { ix, verificationKey: await signingKey.toPublic() as VerificationKey };
    });

    if (typeof derivationResult2 === 'boolean' || 'type' in derivationResult2) {
      throw new Error('Derivation failed');
    }

    expect(derivationResult.ix !== derivationResult2.ix);

    const { ix, verificationKey } = derivationResult;

    const lookedUpIndex = accountManager.lookupKeyIndex(verificationKey);
    expect(lookedUpIndex).toBe(ix);

    const lookedUpKey = accountManager.lookupVerificationKey(ix as KeyIndex);
    expect(lookedUpKey).toEqual(verificationKey);
  });

  test('Signing and verification', async () => {
    const derivationResult = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix, signingKey }) => {
      return { ix, verificationKey: await signingKey.toPublic() };
    });

    if (typeof derivationResult === 'boolean' || 'type' in derivationResult) {
      throw new Error('Derivation failed');
    }

    const { ix } = derivationResult;
    const testMessage = Buffer.from('Test message');
    const signature = await accountManager.sign(ix as KeyIndex, getPassphrase, testMessage);

    if ('type' in signature && (signature.type === 'InvalidPassphrase' || signature.type === 'PassphraseGetterError')) {
      throw new Error('Signing failed');
    }

    const verificationResult = await accountManager.verify(ix as KeyIndex, testMessage, signature);
    expect(verificationResult).toBe(true);
  });

  test('Verification with incorrect message', async () => {
    const derivationResult = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix }) => ix);

    if (typeof derivationResult === 'boolean' || typeof derivationResult === 'object') {
      throw new Error('Derivation failed');
    }

    const ix = derivationResult;
    const testMessage = Buffer.from('Test message');
    const incorrectMessage = Buffer.from('Incorrect message');
    const signature = await accountManager.sign(ix as KeyIndex, getPassphrase, testMessage);

    if ('type' in signature && (signature.type === 'InvalidPassphrase' || signature.type === 'PassphraseGetterError')) {
      throw new Error('Signing failed');
    }

    const verificationResult = await accountManager.verify(ix as KeyIndex, incorrectMessage, signature);
    expect(verificationResult).toBe(false);
  });

  test('AccountManager serialization and deserialization', async () => {
    const ix = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix }) => ix);
    const verificationKey = accountManager.lookupVerificationKey(ix as KeyIndex);
    if('type' in verificationKey && verificationKey.type === 'AccountNotFound') {
      throw new Error('Verification key not found');
    }

    if (typeof ix === 'boolean' || typeof ix === 'object') {
      throw new Error('Derivation failed');
    }
    const testMessage = Buffer.from('Another test message');
    const signature = await accountManager.sign(ix as KeyIndex, getPassphrase, testMessage);

    if ('type' in signature && (signature.type === 'InvalidPassphrase' || signature.type === 'PassphraseGetterError')) {
      throw new Error('Signing failed');
    }
    const vault = accountManager.getVault();
    const deserializedManager = fromVault(vault);
    const fetchedVk = deserializedManager.lookupVerificationKey(ix as KeyIndex);
    if('type' in fetchedVk && fetchedVk.type === 'AccountNotFound') {
      throw new Error('Verification key not found');
    }
    expect(VerificationKey.equal(verificationKey as VerificationKey, fetchedVk as VerificationKey)).toBe(true);
    expect(await deserializedManager.verify(ix as KeyIndex, testMessage, signature)).toBe(true);
  });

  test('Invalid passphrase', async () => {
    const invalidGetPassphrase = mkGetPassphrase(async () => 'invalid-passphrase');
    const result = await accountManager.deriveFreshAccountKey(invalidGetPassphrase, async () => true);
    expect(result).toEqual(invalidPassphrase);
  });

  test('Verification with non-existent account', async () => {
    const nonExistentIndex = 99 as KeyIndex;

    const testMessage = Buffer.from('Test message');
    const dummySignature = Ed25519Signature.fromBytes(Buffer.alloc(64));  // Ed25519 signatures are 64 bytes

    const verificationResult = await accountManager.verify(nonExistentIndex, testMessage, dummySignature);
    expect(verificationResult).toEqual({ type: "AccountNotFound" });
  });

  test('Multiple key derivations', async () => {
    const derivedKeys: { ix: KeyIndex, verificationKey: VerificationKey }[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await accountManager.deriveFreshAccountKey(getPassphrase, async ({ ix, signingKey }) => {
        return { ix, verificationKey: await signingKey.toPublic() as VerificationKey };
      });
      if (typeof result === 'boolean' || 'type' in result) {
        throw new Error('Derivation failed');
      }
      derivedKeys.push(result);
    }

    // Verify that all indices are unique
    expect((new Set(derivedKeys.map(key => key.ix))).size === derivedKeys.length);
    // Verify that all the keys are unique
    expect((new Set(derivedKeys.map(key => key.verificationKey.hex()))).size === derivedKeys.length);

    // Verify that all derived keys are present in the vault
    const vault = accountManager.getVault();
    derivedKeys.forEach(key => {
      expect(vault.accounts.get(key.ix)).toEqual(key.verificationKey);
    });
  });
});
