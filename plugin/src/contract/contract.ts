/* This file implements the Canopy Vault contract logic.
 *
 * Custom transaction types:
 *   - MessageLockVault    : locks tokens into a time-locked vault on-chain
 *   - MessageWithdrawVault: redeems a matured vault (principal + earned rewards)
 *   - MessageVestRelease  : releases vested tokens from admin to beneficiary
 *
 * State key prefixes:
 *   1  = account
 *   2  = pool
 *   7  = params
 *   10 = vault record (keyed by uint64 vault ID)
 *   11 = vault-by-owner index (keyed by owner address + vault ID)
 *   12 = vault counter (global monotonic ID)
 */

import Long from 'long';

import { types } from '../proto/types.js';

import {
    IPluginError,
    ErrInsufficientFunds,
    ErrInvalidAddress,
    ErrInvalidAmount,
    ErrInvalidMessageCast,
    ErrTxFeeBelowStateLimit
} from './error.js';

import type { Plugin, Config } from './plugin.js';
import {
    JoinLenPrefix,
    FromAny,
    Unmarshal,
    type DecodedLockVault,
    type DecodedWithdrawVault,
    type DecodedVestRelease
} from './plugin.js';
import { fileDescriptorProtos } from '../proto/descriptors.js';

// ContractConfig: registers the vault tx types + the default send type with the FSM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ContractConfig: any = {
    name: 'canopy_vault_contract',
    id: 1,
    version: 1,
    supportedTransactions: ['send', 'lockVault', 'withdrawVault', 'vestRelease'],
    transactionTypeUrls: [
        'type.googleapis.com/types.MessageSend',
        'type.googleapis.com/types.MessageLockVault',
        'type.googleapis.com/types.MessageWithdrawVault',
        'type.googleapis.com/types.MessageVestRelease'
    ],
    eventTypeUrls: [],
    fileDescriptorProtos
};

// ─── Vault Record ────────────────────────────────────────────────────────────

interface VaultRecord {
    vaultId: number;
    ownerAddress: Uint8Array;
    amount: number;
    lockDays: number;
    lockTimestamp: number;  // Unix seconds at time of lock
    rewardRateBps: number;  // e.g. 350 = 3.50%
    status: number;         // 0 = active, 1 = withdrawn
    vaultName: string;
    tokenSymbol: string;
}

/** rewardRateBps returns the annual reward in basis points for a given lock period */
function rewardRateBps(lockDays: number): number {
    if (lockDays <= 30)  return 350;   // 3.50%
    if (lockDays <= 90)  return 520;   // 5.20%
    if (lockDays <= 180) return 780;   // 7.80%
    if (lockDays <= 365) return 1050;  // 10.50%
    return 1400;                        // 14.00%
}

/** encodeVault serialises a VaultRecord to JSON bytes for on-chain state storage */
function encodeVault(v: VaultRecord): Uint8Array {
    return Buffer.from(JSON.stringify({
        vaultId: v.vaultId,
        ownerAddress: Buffer.from(v.ownerAddress).toString('hex'),
        amount: v.amount,
        lockDays: v.lockDays,
        lockTimestamp: v.lockTimestamp,
        rewardRateBps: v.rewardRateBps,
        status: v.status,
        vaultName: v.vaultName,
        tokenSymbol: v.tokenSymbol
    }));
}

/** decodeVault deserialises JSON bytes back into a VaultRecord */
function decodeVault(bytes: Uint8Array | null | undefined): VaultRecord | null {
    if (!bytes || bytes.length === 0) return null;
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const obj = JSON.parse(Buffer.from(bytes).toString('utf-8')) as any;
        return {
            vaultId:       Number(obj.vaultId ?? 0),
            ownerAddress:  Buffer.from(obj.ownerAddress ?? '', 'hex'),
            amount:        Number(obj.amount ?? 0),
            lockDays:      Number(obj.lockDays ?? 0),
            lockTimestamp: Number(obj.lockTimestamp ?? 0),
            rewardRateBps: Number(obj.rewardRateBps ?? 0),
            status:        Number(obj.status ?? 0),
            vaultName:     String(obj.vaultName ?? ''),
            tokenSymbol:   String(obj.tokenSymbol ?? 'CNPY')
        };
    } catch {
        return null;
    }
}

/** earnedReward calculates how much reward a vault has earned (pro-rated annual) */
function earnedReward(vault: VaultRecord): number {
    const nowSec      = Math.floor(Date.now() / 1000);
    const elapsedDays = (nowSec - vault.lockTimestamp) / 86400;
    return Math.floor(vault.amount * vault.rewardRateBps / 10000 * elapsedDays / 365);
}

// ─── State Key Helpers ───────────────────────────────────────────────────────

const accountPrefix   = Buffer.from([1]);
const poolPrefix      = Buffer.from([2]);
const paramsPrefix    = Buffer.from([7]);
const vaultPrefix     = Buffer.from([10]);
const vaultOwnerPfx   = Buffer.from([11]);
const vaultCounterKey = Buffer.from([12, 1]); // single global counter

export function KeyForAccount(addr: Uint8Array): Uint8Array {
    return JoinLenPrefix(accountPrefix, Buffer.from(addr));
}
export function KeyForFeeParams(): Uint8Array {
    return JoinLenPrefix(paramsPrefix, Buffer.from('/f/'));
}
export function KeyForFeePool(chainId: Long): Uint8Array {
    return JoinLenPrefix(poolPrefix, uint64ToBytes(chainId));
}
export function KeyForVault(vaultId: Long): Uint8Array {
    return JoinLenPrefix(vaultPrefix, uint64ToBytes(vaultId));
}
export function KeyForVaultByOwner(ownerAddr: Uint8Array, vaultId: Long): Uint8Array {
    return JoinLenPrefix(vaultOwnerPfx, Buffer.from(ownerAddr), uint64ToBytes(vaultId));
}
export function KeyForVaultCounter(): Uint8Array { return vaultCounterKey; }

function uint64ToBytes(u: Long): Buffer {
    const b = Buffer.alloc(8);
    b.writeBigUInt64BE(BigInt(u.toString()));
    return b;
}

// ─── Contract (synchronous, stateless validation) ────────────────────────────

export class Contract {
    Config: Config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    FSMConfig: any;
    plugin: Plugin;
    fsmId: Long;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(config: Config, fsmConfig: any, plugin: Plugin, fsmId: Long) {
        this.Config = config;
        this.FSMConfig = fsmConfig;
        this.plugin = plugin;
        this.fsmId = fsmId;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    Genesis(_request: any): any { return {}; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    BeginBlock(_request: any): any { return {}; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    EndBlock(_request: any): any { return {}; }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CheckMessageSend(msg: any): any {
        if (!msg.fromAddress || msg.fromAddress.length !== 20) return { error: ErrInvalidAddress() };
        if (!msg.toAddress   || msg.toAddress.length   !== 20) return { error: ErrInvalidAddress() };
        const amount = msg.amount as Long | number | undefined;
        if (!amount || (Long.isLong(amount) ? amount.isZero() : amount === 0)) return { error: ErrInvalidAmount() };
        return { recipient: msg.toAddress, authorizedSigners: [msg.fromAddress] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CheckMessageLockVault(msg: DecodedLockVault): any {
        if (!msg.ownerAddress || msg.ownerAddress.length !== 20) return { error: ErrInvalidAddress() };
        const amt  = toLong(msg.amount);
        if (amt.isZero())  return { error: ErrInvalidAmount() };
        const days = toLong(msg.lockDays);
        if (days.isZero()) return { error: ErrInvalidAmount() };
        return { recipient: msg.ownerAddress, authorizedSigners: [msg.ownerAddress] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CheckMessageWithdrawVault(msg: DecodedWithdrawVault): any {
        if (!msg.ownerAddress || msg.ownerAddress.length !== 20) return { error: ErrInvalidAddress() };
        return { recipient: msg.ownerAddress, authorizedSigners: [msg.ownerAddress] };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    CheckMessageVestRelease(msg: DecodedVestRelease): any {
        if (!msg.adminAddress       || msg.adminAddress.length       !== 20) return { error: ErrInvalidAddress() };
        if (!msg.beneficiaryAddress || msg.beneficiaryAddress.length !== 20) return { error: ErrInvalidAddress() };
        if (toLong(msg.amount).isZero()) return { error: ErrInvalidAmount() };
        return { recipient: msg.adminAddress, authorizedSigners: [msg.adminAddress] };
    }
}

// ─── ContractAsync (state-reading / state-writing operations) ────────────────

export class ContractAsync {

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async CheckTx(contract: Contract, request: any): Promise<any> {
        const [resp, err] = await contract.plugin.StateRead(contract, {
            keys: [{ queryId: Long.fromNumber(randId()), key: KeyForFeeParams() }]
        });
        if (err)           return { error: err };
        if (resp?.error)   return { error: resp.error };

        const feeParamsBytes = resp?.results?.[0]?.entries?.[0]?.value;
        if (feeParamsBytes && feeParamsBytes.length > 0) {
            const [minFees, unmarshalErr] = Unmarshal(feeParamsBytes, types.FeeParams);
            if (unmarshalErr) return { error: unmarshalErr };
            const txFee  = request.tx?.fee as Long | number | undefined;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sendFee = (minFees as any)?.sendFee as Long | number | undefined;
            if (txFee !== undefined && sendFee !== undefined) {
                if (toLong(txFee).toNumber() < toLong(sendFee).toNumber()) {
                    return { error: ErrTxFeeBelowStateLimit() };
                }
            }
        }

        const [msg, msgType, msgErr] = FromAny(request.tx?.msg);
        if (msgErr) return { error: msgErr };

        if (msg) {
            switch (msgType) {
                case 'MessageSend':          return contract.CheckMessageSend(msg);
                case 'MessageLockVault':     return contract.CheckMessageLockVault(msg as DecodedLockVault);
                case 'MessageWithdrawVault': return contract.CheckMessageWithdrawVault(msg as DecodedWithdrawVault);
                case 'MessageVestRelease':   return contract.CheckMessageVestRelease(msg as DecodedVestRelease);
                default: return { error: ErrInvalidMessageCast() };
            }
        }
        return { error: ErrInvalidMessageCast() };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async DeliverTx(contract: Contract, request: any): Promise<any> {
        const [msg, msgType, err] = FromAny(request.tx?.msg);
        if (err) return { error: err };

        if (msg) {
            const fee = request.tx?.fee as Long;
            switch (msgType) {
                case 'MessageSend':          return ContractAsync.DeliverMessageSend(contract, msg, fee);
                case 'MessageLockVault':     return ContractAsync.DeliverMessageLockVault(contract, msg as DecodedLockVault, fee);
                case 'MessageWithdrawVault': return ContractAsync.DeliverMessageWithdrawVault(contract, msg as DecodedWithdrawVault, fee);
                case 'MessageVestRelease':   return ContractAsync.DeliverMessageVestRelease(contract, msg as DecodedVestRelease, fee);
                default: return { error: ErrInvalidMessageCast() };
            }
        }
        return { error: ErrInvalidMessageCast() };
    }

    // ── DeliverMessageSend ────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static async DeliverMessageSend(contract: Contract, msg: any, fee: Long | number | undefined): Promise<any> {
        const q1 = Long.fromNumber(randId()), q2 = Long.fromNumber(randId()), q3 = Long.fromNumber(randId());
        const fromKey    = KeyForAccount(msg.fromAddress!);
        const toKey      = KeyForAccount(msg.toAddress!);
        const feePoolKey = KeyForFeePool(Long.fromNumber(contract.Config.ChainId));

        const [response, readErr] = await contract.plugin.StateRead(contract, {
            keys: [
                { queryId: q3, key: feePoolKey },
                { queryId: q1, key: fromKey },
                { queryId: q2, key: toKey }
            ]
        });
        if (readErr)         return { error: readErr };
        if (response?.error) return { error: response.error };

        let fromBytes: Uint8Array | null = null, toBytes: Uint8Array | null = null, feePoolBytes: Uint8Array | null = null;
        for (const r of response?.results || []) {
            const qid = r.queryId as Long;
            if      (qid.equals(q1)) fromBytes    = r.entries?.[0]?.value || null;
            else if (qid.equals(q2)) toBytes      = r.entries?.[0]?.value || null;
            else if (qid.equals(q3)) feePoolBytes = r.entries?.[0]?.value || null;
        }

        const [fromRaw,    fromErr]    = Unmarshal(fromBytes    || new Uint8Array(), types.Account);
        if (fromErr) return { error: fromErr };
        const [toRaw,      toErr]      = Unmarshal(toBytes      || new Uint8Array(), types.Account);
        if (toErr)   return { error: toErr };
        const [feePoolRaw, feePoolErr] = Unmarshal(feePoolBytes || new Uint8Array(), types.Pool);
        if (feePoolErr) return { error: feePoolErr };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const from = fromRaw as any, to = toRaw as any, feePool = feePoolRaw as any;
        const msgAmt  = toLong(msg.amount), feeAmt = toLong(fee);
        const fromBal = toLong(from?.amount);
        if (fromBal.lessThan(msgAmt.add(feeAmt))) return { error: ErrInsufficientFunds() };

        const isSelf    = Buffer.from(fromKey).equals(Buffer.from(toKey));
        const toAccount = isSelf ? from : to;
        const newFromAmt = fromBal.subtract(msgAmt.add(feeAmt));
        const newToAmt   = toLong(toAccount?.amount).add(msgAmt);
        const newPoolAmt = toLong(feePool?.amount).add(feeAmt);

        const newFromBytes    = types.Account.encode(types.Account.create({ address: from?.address, amount: newFromAmt })).finish();
        const newToBytes      = types.Account.encode(types.Account.create({ address: toAccount?.address, amount: newToAmt })).finish();
        const newFeePoolBytes = types.Pool.encode(types.Pool.create({ id: feePool?.id, amount: newPoolAmt })).finish();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let writeResp: any, writeErr: IPluginError | null;
        if (newFromAmt.isZero()) {
            [writeResp, writeErr] = await contract.plugin.StateWrite(contract, {
                sets:    [{ key: feePoolKey, value: newFeePoolBytes }, { key: toKey, value: newToBytes }],
                deletes: [{ key: fromKey }]
            });
        } else {
            [writeResp, writeErr] = await contract.plugin.StateWrite(contract, {
                sets: [{ key: feePoolKey, value: newFeePoolBytes }, { key: toKey, value: newToBytes }, { key: fromKey, value: newFromBytes }]
            });
        }
        if (writeErr)         return { error: writeErr };
        if (writeResp?.error) return { error: writeResp.error };
        return {};
    }

    // ── DeliverMessageLockVault ───────────────────────────────────────────────
    static async DeliverMessageLockVault(
        contract: Contract, msg: DecodedLockVault, fee: Long | number | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        const ownerKey   = KeyForAccount(msg.ownerAddress);
        const counterKey = KeyForVaultCounter();
        const feePoolKey = KeyForFeePool(Long.fromNumber(contract.Config.ChainId));
        const q1 = Long.fromNumber(randId()), q2 = Long.fromNumber(randId()), q3 = Long.fromNumber(randId());

        const [readResp, readErr] = await contract.plugin.StateRead(contract, {
            keys: [{ queryId: q1, key: ownerKey }, { queryId: q2, key: counterKey }, { queryId: q3, key: feePoolKey }]
        });
        if (readErr)          return { error: readErr };
        if (readResp?.error)  return { error: readResp.error };

        let ownerBytes: Uint8Array | null = null, counterBytes: Uint8Array | null = null, feePoolBytes: Uint8Array | null = null;
        for (const r of readResp?.results || []) {
            const qid = r.queryId as Long;
            if      (qid.equals(q1)) ownerBytes   = r.entries?.[0]?.value || null;
            else if (qid.equals(q2)) counterBytes = r.entries?.[0]?.value || null;
            else if (qid.equals(q3)) feePoolBytes = r.entries?.[0]?.value || null;
        }

        const [ownerRaw,   ownerErr]   = Unmarshal(ownerBytes   || new Uint8Array(), types.Account);
        if (ownerErr)   return { error: ownerErr };
        const [feePoolRaw, feePoolErr] = Unmarshal(feePoolBytes || new Uint8Array(), types.Pool);
        if (feePoolErr) return { error: feePoolErr };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const owner = ownerRaw as any, feePool = feePoolRaw as any;
        const lockAmt = toLong(msg.amount), feeAmt = toLong(fee);
        const ownerBal = toLong(owner?.amount);
        if (ownerBal.lessThan(lockAmt.add(feeAmt))) return { error: ErrInsufficientFunds() };

        // assign new vault ID from on-chain counter
        const currentCounter = counterBytes && counterBytes.length === 8
            ? Long.fromBytesBE(Array.from(counterBytes), true)
            : Long.UZERO;
        const newVaultId = currentCounter.add(Long.ONE);
        const newCounterBytes = Buffer.alloc(8);
        newCounterBytes.writeBigUInt64BE(BigInt(newVaultId.toString()));

        const lockDaysNum = toLong(msg.lockDays).toNumber();
        const vault: VaultRecord = {
            vaultId:       newVaultId.toNumber(),
            ownerAddress:  msg.ownerAddress,
            amount:        lockAmt.toNumber(),
            lockDays:      lockDaysNum,
            lockTimestamp: Math.floor(Date.now() / 1000),
            rewardRateBps: rewardRateBps(lockDaysNum),
            status:        0,
            vaultName:     msg.vaultName || 'Vault',
            tokenSymbol:   msg.tokenSymbol || 'CNPY'
        };

        const vaultKey      = KeyForVault(newVaultId);
        const vaultOwnerKey = KeyForVaultByOwner(msg.ownerAddress, newVaultId);
        const vaultBytes    = encodeVault(vault);
        const newOwnerBal   = ownerBal.subtract(lockAmt.add(feeAmt));
        const newPoolBal    = toLong(feePool?.amount).add(feeAmt);

        const sets = [
            { key: vaultKey,      value: vaultBytes },
            { key: vaultOwnerKey, value: vaultBytes },
            { key: counterKey,    value: newCounterBytes },
            { key: feePoolKey,    value: types.Pool.encode(types.Pool.create({ id: feePool?.id, amount: newPoolBal })).finish() }
        ];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let writeResp: any, writeErr: IPluginError | null;
        if (newOwnerBal.isZero()) {
            [writeResp, writeErr] = await contract.plugin.StateWrite(contract, { sets, deletes: [{ key: ownerKey }] });
        } else {
            [writeResp, writeErr] = await contract.plugin.StateWrite(contract, {
                sets: [...sets, { key: ownerKey, value: types.Account.encode(types.Account.create({ address: owner?.address, amount: newOwnerBal })).finish() }]
            });
        }
        if (writeErr)         return { error: writeErr };
        if (writeResp?.error) return { error: writeResp.error };
        return { vaultId: newVaultId.toNumber() };
    }

    // ── DeliverMessageWithdrawVault ───────────────────────────────────────────
    static async DeliverMessageWithdrawVault(
        contract: Contract, msg: DecodedWithdrawVault, fee: Long | number | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        const vaultId    = toLong(msg.vaultId);
        const vaultKey   = KeyForVault(vaultId);
        const ownerKey   = KeyForAccount(msg.ownerAddress);
        const feePoolKey = KeyForFeePool(Long.fromNumber(contract.Config.ChainId));
        const q1 = Long.fromNumber(randId()), q2 = Long.fromNumber(randId()), q3 = Long.fromNumber(randId());

        const [readResp, readErr] = await contract.plugin.StateRead(contract, {
            keys: [{ queryId: q1, key: vaultKey }, { queryId: q2, key: ownerKey }, { queryId: q3, key: feePoolKey }]
        });
        if (readErr)          return { error: readErr };
        if (readResp?.error)  return { error: readResp.error };

        let vaultBytes: Uint8Array | null = null, ownerBytes: Uint8Array | null = null, feePoolBytes: Uint8Array | null = null;
        for (const r of readResp?.results || []) {
            const qid = r.queryId as Long;
            if      (qid.equals(q1)) vaultBytes   = r.entries?.[0]?.value || null;
            else if (qid.equals(q2)) ownerBytes   = r.entries?.[0]?.value || null;
            else if (qid.equals(q3)) feePoolBytes = r.entries?.[0]?.value || null;
        }

        const vault = decodeVault(vaultBytes);
        if (!vault) return { error: { code: 1, module: 'plugin', msg: 'vault not found' } };
        if (!Buffer.from(vault.ownerAddress).equals(Buffer.from(msg.ownerAddress))) {
            return { error: { code: 2, module: 'plugin', msg: 'vault owner mismatch' } };
        }
        if (vault.status !== 0) {
            return { error: { code: 3, module: 'plugin', msg: 'vault already withdrawn' } };
        }
        const matureAtSec = vault.lockTimestamp + vault.lockDays * 86400;
        if (Math.floor(Date.now() / 1000) < matureAtSec) {
            return { error: { code: 4, module: 'plugin', msg: 'vault not yet matured' } };
        }

        const reward       = earnedReward(vault);
        const totalReturn  = vault.amount + reward;
        const [ownerRaw,   ownerErr]   = Unmarshal(ownerBytes   || new Uint8Array(), types.Account);
        if (ownerErr) return { error: ownerErr };
        const [feePoolRaw, feePoolErr] = Unmarshal(feePoolBytes || new Uint8Array(), types.Pool);
        if (feePoolErr) return { error: feePoolErr };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const owner = ownerRaw as any, feePool = feePoolRaw as any;
        const feeAmt  = toLong(fee);
        const ownerBal = toLong(owner?.amount);
        if (ownerBal.lessThan(feeAmt)) return { error: ErrInsufficientFunds() };

        vault.status = 1;
        const updatedVaultBytes = encodeVault(vault);
        const vaultOwnerKey     = KeyForVaultByOwner(msg.ownerAddress, vaultId);
        const newOwnerBal       = ownerBal.subtract(feeAmt).add(Long.fromNumber(totalReturn));
        const newPoolBal        = toLong(feePool?.amount).add(feeAmt);

        const [writeResp, writeErr] = await contract.plugin.StateWrite(contract, {
            sets: [
                { key: vaultKey,      value: updatedVaultBytes },
                { key: vaultOwnerKey, value: updatedVaultBytes },
                { key: ownerKey,      value: types.Account.encode(types.Account.create({ address: owner?.address, amount: newOwnerBal })).finish() },
                { key: feePoolKey,    value: types.Pool.encode(types.Pool.create({ id: feePool?.id, amount: newPoolBal })).finish() }
            ]
        });
        if (writeErr)         return { error: writeErr };
        if (writeResp?.error) return { error: writeResp.error };
        return { reward, totalReturn };
    }

    // ── DeliverMessageVestRelease ─────────────────────────────────────────────
    static async DeliverMessageVestRelease(
        contract: Contract, msg: DecodedVestRelease, fee: Long | number | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ): Promise<any> {
        const adminKey   = KeyForAccount(msg.adminAddress);
        const benefKey   = KeyForAccount(msg.beneficiaryAddress);
        const feePoolKey = KeyForFeePool(Long.fromNumber(contract.Config.ChainId));
        const q1 = Long.fromNumber(randId()), q2 = Long.fromNumber(randId()), q3 = Long.fromNumber(randId());

        const [readResp, readErr] = await contract.plugin.StateRead(contract, {
            keys: [{ queryId: q1, key: adminKey }, { queryId: q2, key: benefKey }, { queryId: q3, key: feePoolKey }]
        });
        if (readErr)          return { error: readErr };
        if (readResp?.error)  return { error: readResp.error };

        let adminBytes: Uint8Array | null = null, benefBytes: Uint8Array | null = null, feePoolBytes: Uint8Array | null = null;
        for (const r of readResp?.results || []) {
            const qid = r.queryId as Long;
            if      (qid.equals(q1)) adminBytes   = r.entries?.[0]?.value || null;
            else if (qid.equals(q2)) benefBytes   = r.entries?.[0]?.value || null;
            else if (qid.equals(q3)) feePoolBytes = r.entries?.[0]?.value || null;
        }

        const [adminRaw,   adminErr]   = Unmarshal(adminBytes   || new Uint8Array(), types.Account);
        if (adminErr) return { error: adminErr };
        const [benefRaw,   benefErr]   = Unmarshal(benefBytes   || new Uint8Array(), types.Account);
        if (benefErr) return { error: benefErr };
        const [feePoolRaw, feePoolErr] = Unmarshal(feePoolBytes || new Uint8Array(), types.Pool);
        if (feePoolErr) return { error: feePoolErr };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const admin = adminRaw as any, benef = benefRaw as any, feePool = feePoolRaw as any;
        const feeAmt     = toLong(fee);
        const adminBal   = toLong(admin?.amount);
        if (adminBal.lessThan(feeAmt)) return { error: ErrInsufficientFunds() };

        const releaseAmt  = toLong(msg.amount);
        const newAdminBal = adminBal.subtract(feeAmt);
        const newBenefBal = toLong(benef?.amount).add(releaseAmt);
        const newPoolBal  = toLong(feePool?.amount).add(feeAmt);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let writeResp: any, writeErr: IPluginError | null;
        const commonSets = [
            { key: benefKey,   value: types.Account.encode(types.Account.create({ address: benef?.address, amount: newBenefBal })).finish() },
            { key: feePoolKey, value: types.Pool.encode(types.Pool.create({ id: feePool?.id, amount: newPoolBal })).finish() }
        ];
        if (newAdminBal.isZero()) {
            [writeResp, writeErr] = await contract.plugin.StateWrite(contract, { sets: commonSets, deletes: [{ key: adminKey }] });
        } else {
            [writeResp, writeErr] = await contract.plugin.StateWrite(contract, {
                sets: [{ key: adminKey, value: types.Account.encode(types.Account.create({ address: admin?.address, amount: newAdminBal })).finish() }, ...commonSets]
            });
        }
        if (writeErr)         return { error: writeErr };
        if (writeResp?.error) return { error: writeResp.error };
        return {};
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLong(val: Long | number | undefined): Long {
    if (Long.isLong(val)) return val;
    return Long.fromNumber((val as number) || 0);
}

function randId(): number {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
}
