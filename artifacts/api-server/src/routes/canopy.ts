/**
 * canopy.ts — Canopy chain RPC proxy routes
 *
 * These endpoints bridge the frontend to the Canopy chain RPC (ports 50002/50003).
 * They expose:
 *   GET  /api/canopy/status          - chain connectivity status & block height
 *   GET  /api/canopy/account/:addr   - account balance on-chain
 *   POST /api/canopy/tx/lock-vault   - build + submit a MessageLockVault tx
 *   POST /api/canopy/tx/withdraw-vault - build + submit a MessageWithdrawVault tx
 *   POST /api/canopy/tx/vest-release - build + submit a MessageVestRelease tx
 *
 * All write endpoints accept a pre-signed transaction payload from the client.
 * The server forwards it directly to the Canopy RPC at port 50002.
 */

import { Router, type IRouter } from "express";
import {
  isCanopyAvailable,
  getChainHeight,
  getAccountBalance,
  submitTransaction,
  buildLockVaultTxPayload,
  buildWithdrawVaultTxPayload,
  buildVestReleaseTxPayload,
} from "../lib/canopy-rpc";

const router: IRouter = Router();

/**
 * GET /api/canopy/status
 * Returns Canopy chain connectivity status and current block height.
 * The frontend uses this to show whether the app is running on-chain.
 */
router.get("/canopy/status", async (req, res): Promise<void> => {
  const available = await isCanopyAvailable();
  const height = available ? await getChainHeight() : null;

  res.json({
    online: available,
    height,
    rpcUrl: `${process.env["CANOPY_RPC_HOST"] ?? "localhost"}:${process.env["CANOPY_RPC_PORT"] ?? "50002"}`,
    message: available
      ? `Connected to Canopy chain at block ${height}`
      : "Canopy chain not reachable — running in local-database mode. Start a local Canopy node to enable on-chain transactions.",
  });
});

/**
 * GET /api/canopy/account/:address
 * Queries an account balance directly from the Canopy chain state.
 *
 * @param address - 20-byte address in hex format (without 0x)
 */
router.get("/canopy/account/:address", async (req, res): Promise<void> => {
  const { address } = req.params;

  if (!address || address.length !== 40 || !/^[0-9a-fA-F]+$/.test(address)) {
    res.status(400).json({ error: "Invalid address format. Expected 40-character hex string." });
    return;
  }

  const account = await getAccountBalance(address);

  if (!account) {
    res.status(404).json({
      error: "Account not found on chain, or chain is not available.",
      address,
    });
    return;
  }

  res.json(account);
});

/**
 * POST /api/canopy/tx/lock-vault
 * Submits a signed MessageLockVault transaction to the Canopy chain.
 *
 * The request body should contain a fully signed transaction (see canopy-rpc.ts
 * buildLockVaultTxPayload for the unsigned structure, then add signature).
 *
 * Body fields:
 *   - ownerAddress: hex-encoded 20-byte address
 *   - amount: tokens in uCNPY
 *   - lockDays: lock period in days
 *   - vaultName: human-readable name
 *   - tokenSymbol: e.g. "CNPY"
 *   - fee: transaction fee in uCNPY
 *   - chainId: Canopy chain ID (from plugin config)
 *   - networkId: Canopy network ID
 *   - signature: { publicKey, signature } (BLS12-381, base64)
 */
router.post("/canopy/tx/lock-vault", async (req, res): Promise<void> => {
  const {
    ownerAddress,
    amount,
    lockDays,
    vaultName,
    tokenSymbol,
    fee,
    chainId,
    networkId,
    createdHeight,
    signature,
  } = req.body as {
    ownerAddress?: string;
    amount?: number;
    lockDays?: number;
    vaultName?: string;
    tokenSymbol?: string;
    fee?: number;
    chainId?: number;
    networkId?: number;
    createdHeight?: number;
    signature?: { publicKey: string; signature: string };
  };

  if (!ownerAddress || !amount || !lockDays || !fee || !chainId || !networkId) {
    res.status(400).json({
      error: "Missing required fields: ownerAddress, amount, lockDays, fee, chainId, networkId",
    });
    return;
  }

  const txPayload = {
    ...buildLockVaultTxPayload({
      ownerAddress,
      amount,
      lockDays,
      vaultName: vaultName ?? "Vault",
      tokenSymbol: tokenSymbol ?? "CNPY",
      fee,
      chainId,
      networkId,
      createdHeight: createdHeight ?? 0,
    }),
    signature,
  };

  try {
    const result = await submitTransaction(txPayload);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to submit transaction to Canopy chain",
    });
  }
});

/**
 * POST /api/canopy/tx/withdraw-vault
 * Submits a signed MessageWithdrawVault transaction to the Canopy chain.
 *
 * Body fields:
 *   - ownerAddress: hex-encoded 20-byte address
 *   - vaultId: numeric vault ID (assigned at lock time)
 *   - fee: transaction fee in uCNPY
 *   - chainId, networkId, signature (as above)
 */
router.post("/canopy/tx/withdraw-vault", async (req, res): Promise<void> => {
  const {
    ownerAddress,
    vaultId,
    fee,
    chainId,
    networkId,
    createdHeight,
    signature,
  } = req.body as {
    ownerAddress?: string;
    vaultId?: number;
    fee?: number;
    chainId?: number;
    networkId?: number;
    createdHeight?: number;
    signature?: { publicKey: string; signature: string };
  };

  if (!ownerAddress || vaultId === undefined || !fee || !chainId || !networkId) {
    res.status(400).json({
      error: "Missing required fields: ownerAddress, vaultId, fee, chainId, networkId",
    });
    return;
  }

  const txPayload = {
    ...buildWithdrawVaultTxPayload({
      ownerAddress,
      vaultId,
      fee,
      chainId,
      networkId,
      createdHeight: createdHeight ?? 0,
    }),
    signature,
  };

  try {
    const result = await submitTransaction(txPayload);
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to submit transaction to Canopy chain",
    });
  }
});

/**
 * POST /api/canopy/tx/vest-release
 * Submits a signed MessageVestRelease transaction to the Canopy chain.
 *
 * Body fields:
 *   - adminAddress: hex-encoded 20-byte admin address
 *   - beneficiaryAddress: hex-encoded 20-byte beneficiary
 *   - amount: tokens to release in uCNPY
 *   - vestId: vesting schedule ID
 *   - fee, chainId, networkId, signature (as above)
 */
router.post("/canopy/tx/vest-release", async (req, res): Promise<void> => {
  const {
    adminAddress,
    beneficiaryAddress,
    amount,
    vestId,
    fee,
    chainId,
    networkId,
    createdHeight,
    signature,
  } = req.body as {
    adminAddress?: string;
    beneficiaryAddress?: string;
    amount?: number;
    vestId?: number;
    fee?: number;
    chainId?: number;
    networkId?: number;
    createdHeight?: number;
    signature?: { publicKey: string; signature: string };
  };

  if (!adminAddress || !beneficiaryAddress || !amount || vestId === undefined || !fee || !chainId || !networkId) {
    res.status(400).json({
      error: "Missing required fields: adminAddress, beneficiaryAddress, amount, vestId, fee, chainId, networkId",
    });
    return;
  }

  const txPayload = {
    ...buildVestReleaseTxPayload({
      adminAddress,
      beneficiaryAddress,
      amount,
      vestId,
      fee,
      chainId,
      networkId,
      createdHeight: createdHeight ?? 0,
    }),
    signature,
  };

  try {
    const result = await submitTransaction(txPayload);
    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to submit transaction to Canopy chain",
    });
  }
});

export default router;
