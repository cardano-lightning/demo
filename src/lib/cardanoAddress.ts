import { mnemonicToEntropy } from '@scure/bip39';
import * as english from '@scure/bip39/wordlists/english';
import { Bip32Ed25519, Bip32PrivateKey, Ed25519PrivateKey, Ed25519PublicKey, Ed25519Signature, SodiumBip32Ed25519 } from '@cardano-sdk/crypto';
import { Tagged } from 'type-fest';
import { type HexBlob } from '@cardano-sdk/util';

// cardano-sdk's APis is a bit convoluted - if we look at Bip32Ed25519 (implemented by SodiumBip32Ed25519):
// * operations return "hex" values all the time so you have these values back
// * the main interface for signing which is:
//    `sign( privateKey: Ed25519PrivateExtendedKeyHex | Ed25519PrivateNormalKeyHex, message: HexBlob): Promise<Ed25519SignatureHex>;
//   actually just deserializes hex and calls the key signing method
// * derivation for the full path returns extended key which is not neccessarily useful AFAIU because that the usually it is 
//  "last derivation" point and it should be ended by "normal" key extraction.
const bip32Ed25519: Bip32Ed25519 = new SodiumBip32Ed25519();

// Please do ńot confuse the `secondFactor` password (or 25th word) which could be
// used in combinatoin with mnemonic to derive the initial entropy with the passphrase
// which we usually use together with in mmeory an app key manager.
export function fromRecoveryPhrase(mnemonic: string, secondFactor: string = ''): Bip32PrivateKey {
  // When I use here: mnemonicToEntropy'bip39' which does not accept wordlist it does not generate
  // the same keys as `cardano-address` - please check our test suite.
  const entropy = Buffer.from(mnemonicToEntropy(mnemonic, english.wordlist));
  const bip32Ed25519 = new SodiumBip32Ed25519();
  const rootPrivateKey = Bip32PrivateKey.fromHex(bip32Ed25519.fromBip39Entropy(entropy, secondFactor));

  // Encode as Bech32
  return rootPrivateKey;
}

export const harden = (num: number): number => 0x80_00_00_00 + num;

// https://cardano.stackexchange.com/a/7676:
// m / 1852' / 1815' / x' / 0, 1, or 2 / n
//
// m is the mnemonic
// 1852 is the coin (ADA) ID#
// 1815 is an extra, unused path
// x is the account/wallet index #
// 0/1 are wallet x's payment/change keys-paths, and 2 is it's staking key-path
// n is the key #

export type WalletIndex = Tagged<number, "WalletIndex">;

export enum KeyRole {
  External = 0, // or "payment" - We use this for now instead of creating antoher one.
  Internal = 1, // or "change"
  Stake = 2,
  DRep = 3,
}

export type KeyIndex = Tagged<number, "KeyIndex">;

export const hexBlobFromBuffer = (buffer: Buffer): HexBlob => buffer.toString('hex') as HexBlob;

export type RootBip32PrivateKey = Tagged<Bip32PrivateKey, "RootBip32PrivateKey">;

// Derived from the full path. Extended part dropped. Ready to sign!
// So just: key.sign
export type NormalPrivateKey = Tagged<Ed25519PrivateKey, "NormalPrivateKey">;

export const sign = async (privateKey: NormalPrivateKey, message: Buffer): Promise<Ed25519Signature> => {
  return await privateKey.sign(message.toString('hex') as HexBlob);
}

export type NormalPublicKey = Tagged<Ed25519PublicKey, "NormalPublicKey">;

export const verify = async (publicKey: NormalPublicKey, signature: Ed25519Signature, message: Buffer): Promise<boolean> => {
  return publicKey.verify(signature, hexBlobFromBuffer(message));
}

export const deriveNormalSigningKey = async (rootPrivateKey: RootBip32PrivateKey, accountIndex: WalletIndex, role: KeyRole, index: KeyIndex): Promise<NormalPrivateKey> => {
  const accountKeyHex = await bip32Ed25519.derivePrivateKey(rootPrivateKey.hex(), [
    harden(1852),
    harden(1815),
    harden(accountIndex)
  ]);
  const privateKeyHex = await bip32Ed25519.derivePrivateKey(accountKeyHex, [role, index]);
  const privateKey = Bip32PrivateKey.fromHex(privateKeyHex);
  return privateKey.toRawKey() as NormalPrivateKey;
}

