/**
 * canopy-rpc.ts
 *
 * HTTP client for the Canopy chain RPC API.
 *
 * Canopy exposes two RPC ports:
 *   - Port 50002: Public RPC (query chain state, submit transactions)
 *   - Port 50003: Admin RPC (keystore management, admin operations)
 *
 * All custom vault transactions (lockVault, withdrawVault, vestRelease)
 * are submitted through port 50002 using the /v1/tx endpoint.
 * Chain state queries (account balances, block height) use /v1/query/*.
 *
 * Reference: https://canopy-network.gitbook.io/docs
 */

const CANOPY_RPC_HOST = process.env["CANOPY_RPC_HOST"] ?? "localhost";
const CANOPY_RPC_PORT = process.env["CANOPY_RPC_PORT"] ?? "50002";
const CANOPY_ADMIN_PORT = process.env["CANOPY_ADMIN_PORT"] ?? "50003";

const RPC_BASE = `http://${CANOPY_RPC_HOST}:${CANOPY_RPC_PORT}/v1`;
const ADMIN_BASE = `http://${CANOPY_RPC_HOST}:${CANOPY_ADMIN_PORT}/v1`;

export interface CanopyRPCError {
  code: number;
  message: string;
}

export interface ChainInfo {
  height: number;
  chainId: number;
  networkId: number;
}

export interface AccountInfo {
  address: string;
  amount: number;
}

export interface TxResult {
  txHash: string;
  height: number;
  error?: string;
}

/**
 * isCanopyAvailable checks if the Canopy RPC is reachable.
 * Used to decide whether to use on-chain or fallback mode.
 */
export async function isCanopyAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${RPC_BASE}/height`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * getChainHeight returns the current block height from the Canopy chain.
 */
export async function getChainHeight(): Promise<number | null> {
  try {
    const res = await fetch(`${RPC_BASE}/height`);
    if (!res.ok) return null;
    const data = (await res.json()) as { height?: number };
    return data.height ?? null;
  } catch {
    return null;
  }
}

/**
 * getAccountBalance queries an account's balance on the Canopy chain.
 * Returns null if the account doesn't exist or chain is unavailable.
 *
 * @param address - hex-encoded 20-byte address (without 0x prefix)
 */
export async function getAccountBalance(address: string): Promise<AccountInfo | null> {
  try {
    const res = await fetch(`${RPC_BASE}/query/account/${address}`);
    if (!res.ok) return null;
    const data = (await res.json()) as AccountInfo;
    return data;
  } catch {
    return null;
  }
}

/**
 * submitTransaction submits a signed transaction to the Canopy chain.
 * Transactions must be signed with BLS12-381 keys (see plugin/typescript/tutorial).
 *
 * The transaction payload must include:
 *   - messageType: one of "lockVault", "withdrawVault", "vestRelease", "send"
 *   - msg: google.protobuf.Any encoded message bytes (base64)
 *   - signature: { publicKey, signature } (BLS12-381, base64)
 *   - fee: transaction fee in uCNPY
 *   - networkId: Canopy network ID
 *   - chainId: your chain ID (matches plugin config)
 *
 * @param txPayload - JSON-serializable signed transaction object
 */
export async function submitTransaction(
  txPayload: Record<string, unknown>
): Promise<TxResult> {
  const res = await fetch(`${RPC_BASE}/tx`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(txPayload),
  });

  const data = (await res.json()) as TxResult & { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? `RPC error ${res.status}`);
  }

  return data;
}

/**
 * queryChainVaults performs a range read of vault records from the Canopy
 * chain state via the plugin's custom RPC query endpoint.
 *
 * NOTE: This requires the Canopy node to expose a custom query route
 * via the plugin's QueryTx handler. If not yet implemented, returns null
 * and the caller should fall back to the local PostgreSQL mirror.
 */
export async function queryChainVaults(): Promise<unknown[] | null> {
  try {
    const res = await fetch(`${RPC_BASE}/query/plugin/vaults`);
    if (!res.ok) return null;
    return (await res.json()) as unknown[];
  } catch {
    return null;
  }
}

/**
 * getNewAccount creates a new account in the Canopy keystore.
 * Uses the admin RPC (port 50003). Only call from trusted server code.
 *
 * @param label - human-readable label for this key
 */
export async function getNewAccount(
  label: string
): Promise<{ address: string; publicKey: string } | null> {
  try {
    const res = await fetch(`${ADMIN_BASE}/key/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });
    if (!res.ok) return null;
    return (await res.json()) as { address: string; publicKey: string };
  } catch {
    return null;
  }
}

/**
 * buildLockVaultTxPayload constructs the unsigned transaction payload for
 * a MessageLockVault transaction. The client is responsible for signing.
 *
 * This shows the structure expected by the Canopy RPC /v1/tx endpoint
 * when submitting a custom vault lock transaction.
 */
export function buildLockVaultTxPayload(params: {
  ownerAddress: string;
  amount: number;
  lockDays: number;
  vaultName: string;
  tokenSymbol: string;
  fee: number;
  chainId: number;
  networkId: number;
  createdHeight: number;
}): Record<string, unknown> {
  return {
    messageType: "lockVault",
    msgTypeUrl: "type.googleapis.com/types.MessageLockVault",
    msgBytes: Buffer.from(
      JSON.stringify({
        ownerAddress: params.ownerAddress,
        amount: params.amount,
        lockDays: params.lockDays,
        vaultName: params.vaultName,
        tokenSymbol: params.tokenSymbol,
      })
    ).toString("base64"),
    fee: params.fee,
    chainId: params.chainId,
    networkId: params.networkId,
    createdHeight: params.createdHeight,
    time: Date.now(),
    memo: `Lock ${params.vaultName} vault`,
  };
}

/**
 * buildWithdrawVaultTxPayload constructs the unsigned transaction payload for
 * a MessageWithdrawVault transaction.
 */
export function buildWithdrawVaultTxPayload(params: {
  ownerAddress: string;
  vaultId: number;
  fee: number;
  chainId: number;
  networkId: number;
  createdHeight: number;
}): Record<string, unknown> {
  return {
    messageType: "withdrawVault",
    msgTypeUrl: "type.googleapis.com/types.MessageWithdrawVault",
    msgBytes: Buffer.from(
      JSON.stringify({
        ownerAddress: params.ownerAddress,
        vaultId: params.vaultId,
      })
    ).toString("base64"),
    fee: params.fee,
    chainId: params.chainId,
    networkId: params.networkId,
    createdHeight: params.createdHeight,
    time: Date.now(),
    memo: `Withdraw vault #${params.vaultId}`,
  };
}

/**
 * buildVestReleaseTxPayload constructs the unsigned transaction payload for
 * a MessageVestRelease transaction.
 */
export function buildVestReleaseTxPayload(params: {
  adminAddress: string;
  beneficiaryAddress: string;
  amount: number;
  vestId: number;
  fee: number;
  chainId: number;
  networkId: number;
  createdHeight: number;
}): Record<string, unknown> {
  return {
    messageType: "vestRelease",
    msgTypeUrl: "type.googleapis.com/types.MessageVestRelease",
    msgBytes: Buffer.from(
      JSON.stringify({
        adminAddress: params.adminAddress,
        beneficiaryAddress: params.beneficiaryAddress,
        amount: params.amount,
        vestId: params.vestId,
      })
    ).toString("base64"),
    fee: params.fee,
    chainId: params.chainId,
    networkId: params.networkId,
    createdHeight: params.createdHeight,
    time: Date.now(),
    memo: `Vest release #${params.vestId}`,
  };
}
