import { Ed25519PublicKey, Ed25519Signature } from '@cardano-sdk/crypto';
import type { Tagged } from 'type-fest';
import cbor from 'cbor-x';
import { KeysManager, KeysManagerVault, mkKeysManager } from './keyManager';
import { GetPassphrase, InvalidPassphrase, Mnemonic, PassphraseGetterError } from './secretManager';
import * as cardanoAddress from './cardanoAddress';
import { AccountIndex, KeyIndex, KeyRole, NormalPublicKey } from './cardanoAddress';

export type ChannelId = Tagged<Buffer, "ChannelId">;

enum Role { Party = 0, Counterparty = 1 };

export type ChequeBody = {
  channelId: ChannelId;
  sender: Role;
  amount: bigint;
};

// Cheque which signature was not verified
export type ChequeContent = {
  body: ChequeBody;
  signature: Ed25519Signature;
}

// Cheque which signature was verified
export type Cheque = Tagged<ChequeContent, "Cheque">;

export namespace VarLenBigInt {
  export const serialize = (n: bigint) => {
    let hex = n.toString(16);
    if (hex.length % 2 !== 0) {
        hex = '0' + hex;
    }
    return Buffer.from(hex, 'hex');
  }
  export const deserialize = (buf: Buffer) => {
    return BigInt('0x' + buf.toString('hex'));
  }
}

// We sign this. Smart contract rebbuilds that and verifies the signature.
export type ChequBodyBytes = Tagged<Buffer, "ChequeBodyBytes">;

export const mkChequeBodyBytes = (chequeBody: ChequeBody): ChequBodyBytes => {
  return Buffer.concat([
    // constant width
    chequeBody.channelId,
    // constant width
    chequeBody.sender === Role.Party ? Buffer.from([0]) : Buffer.from([1]), // 
    // variable width - BigEndian encoding without padding of the integer
    VarLenBigInt.serialize(chequeBody.amount),
  ]) as ChequBodyBytes;
}

// We pass this to smart contract and read this from tx
export type ChequeCBOR = Tagged<Buffer, "ChequeCBOR">;

export const serializeCheque = (cheque: Cheque): ChequeCBOR => {
  return cbor.encode([
    cheque.body.channelId,
    cheque.body.sender,
    cheque.body.amount,
    cheque.signature
  ]) as ChequeCBOR;
}

type ChequeContentDeserializationError = { type: "ChequeContentDeserializationError" };

export const deserializeChequeContent = (chequeCBOR: ChequeCBOR): ChequeContent | ChequeContentDeserializationError => {
  // TODO: Add cheque value level validation
  const [channelId, sender, amount, signature] = cbor.decode(chequeCBOR);
  return {
    body: {
      channelId,
      sender,
      amount
    },
    signature
  };
}

type ChequeValidationError = { type: "ChequeValidationError" };

export const verifyCheque = (chequeContent: ChequeContent, senderKey: NormalPublicKey): Cheque | ChequeValidationError => {
  const chequeBytes = mkChequeBodyBytes(chequeContent.body);
  if (!cardanoAddress.verify(senderKey, chequeContent.signature, chequeBytes)) {
    return { type: "ChequeValidationError" };
  }
  return chequeContent as Cheque;
}
