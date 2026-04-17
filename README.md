# 🌿 Canopy Vault

> **Canopy Vault is an onchain DeFi token security platform built on the Canopy blockchain. It lets users lock, vest, and track tokens with custom on-chain transaction types — vault locking, vesting releases, and withdrawals all live on the Canopy chain via RPC.**

**One-line pitch:** Canopy Vault is an onchain DeFi vault platform that uses Canopy's TypeScript plugin to lock, vest, and release tokens with custom transaction types — enforced by the chain, not just a UI.

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🔒 **On-chain Token Vault Locking** | Custom `MessageLockVault` transaction type — tokens locked directly on Canopy chain |
| 🏦 **On-chain Vault Withdrawal** | Custom `MessageWithdrawVault` transaction type — matured vaults redeemed on-chain with earned rewards |
| 📅 **On-chain Vesting Releases** | Custom `MessageVestRelease` transaction type — admin-authorized token vesting, recorded on-chain |
| 📊 **Portfolio Dashboard** | Real-time charts for vault balances, lock status, and reward accrual |
| 💧 **Liquidity Locking** | Track LP token locks |
| 🔗 **Canopy RPC Integration** | App talks to Canopy chain via RPC ports 50002 (public) and 50003 (admin) |

---

## 🏗️ Tech Stack

- **Blockchain:** Canopy Network (TypeScript plugin with custom transaction types)
- **Plugin RPC:** Canopy FSM via Unix socket + Canopy public RPC port 50002 / admin RPC port 50003
- **Frontend:** React + Vite + TypeScript
- **Backend:** Express.js + TypeScript (bridges frontend to Canopy RPC)
- **Database:** PostgreSQL (local mirror/fallback for UI state)
- **API:** OpenAPI 3.0 with auto-generated client & Zod validators
- **Charts:** Recharts
- **UI:** Tailwind CSS + shadcn/ui

---

## 📁 Project Structure

```
canopy-vault/
├── plugin/
│   └── typescript/              # Canopy TypeScript plugin (CORE ONCHAIN LOGIC)
│       ├── proto/
│       │   └── tx.proto         # Custom transaction types: MessageLockVault, MessageWithdrawVault, MessageVestRelease
│       ├── src/
│       │   └── contract/
│       │       ├── contract.ts  # CheckTx + DeliverTx handlers for all custom tx types
│       │       └── plugin.ts    # FSM socket communication + FromAny dispatch
│       ├── AGENTS.md            # AI context file for this plugin
│       └── TUTORIAL.md          # Guide for building on this plugin
├── artifacts/
│   ├── api-server/
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   └── canopy-rpc.ts  # Canopy RPC client (port 50002/50003)
│   │   │   └── routes/
│   │   │       └── canopy.ts      # /api/canopy/* endpoints (chain status, tx submission)
│   └── token-vault/             # React + Vite frontend
├── lib/
│   ├── api-spec/                # OpenAPI specification
│   ├── api-client-react/        # Auto-generated React Query hooks
│   ├── api-zod/                 # Auto-generated Zod validators
│   └── db/                      # Drizzle ORM schema & migrations
└── README.md
```

---

## 🔗 Canopy Plugin — Custom Transaction Types

The plugin (`plugin/typescript/`) extends the Canopy FSM with three vault-specific transaction types:

### `MessageLockVault`
Locks tokens into a time-locked vault on-chain.
- Deducts tokens from owner's account in chain state
- Creates a `VaultRecord` in chain state (69-byte binary record)
- Computes reward rate on-chain based on `lock_days`
- Assigns a monotonic vault ID from an on-chain counter

### `MessageWithdrawVault`
Withdraws tokens + earned rewards from a matured vault.
- Verifies vault ownership against chain state
- Verifies maturity date has passed (on-chain time check)
- Mints earned rewards to owner's account
- Marks vault as `status=1` (withdrawn) in chain state

### `MessageVestRelease`
Releases vested tokens from admin to beneficiary.
- Admin authorizes and pays the fee
- New tokens are minted to beneficiary (controlled supply expansion)
- Implements linear vesting with cliff period support

### Reward Rates (computed on-chain)

| Lock Duration | APY Reward |
|--------------|-----------|
| ≤ 30 days | 3.5% |
| ≤ 90 days | 5.2% |
| ≤ 180 days | 7.8% |
| ≤ 365 days | 10.5% |
| > 365 days | 14.0% |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- pnpm
- PostgreSQL database
- Go 1.24+ (to build Canopy binary)
- Canopy binary ([github.com/canopy-network/canopy](https://github.com/canopy-network/canopy))

### 1. Clone and install

```bash
git clone https://github.com/Ismawat23/canopy-vault.git
cd canopy-vault

pnpm install
```

### 2. Build the Canopy plugin

```bash
cd plugin/typescript
npm install
npm run build:all   # regenerates protobuf code + compiles TypeScript
```

> **Note:** `build:all` runs `build:proto` (requires `protobufjs-cli`) then compiles TypeScript.
> Install globally if needed: `npm install -g protobufjs-cli`

### 3. Set up and start a local Canopy chain with the plugin

```bash
# Build Canopy binary (from the canopy repo root)
make build/canopy

# Initialize the chain config
~/go/bin/canopy start   # run once to generate ~/.canopy/config.json, then Ctrl+C

# Enable the TypeScript plugin in config
# Edit ~/.canopy/config.json and add/update:
# { "plugin": "typescript", ... }

# Start Canopy — this also starts the TypeScript plugin automatically
~/go/bin/canopy start
```

The Canopy node exposes:
- **Port 50002** — Public RPC (submit transactions, query chain state)
- **Port 50003** — Admin RPC (keystore management)

### 4. Set up the app database

```bash
# Set environment variables
export DATABASE_URL="postgresql://user:password@localhost:5432/canopy_vault"
export SESSION_SECRET="your-secret"

# Push DB schema
pnpm --filter @workspace/db run db:push
```

### 5. Run the app

```bash
# Terminal 1: API server
pnpm --filter @workspace/api-server run dev

# Terminal 2: Frontend
pnpm --filter @workspace/token-vault run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

The sidebar will show **"On-chain"** with the current block height when connected to the Canopy node.
If the node is not running, the app falls back to local PostgreSQL mode.

---

## 📡 Canopy RPC Endpoints (port 50002)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v1/height` | Current block height |
| GET | `/v1/query/account/:addr` | Account balance on-chain |
| POST | `/v1/tx` | Submit signed transaction (lockVault, withdrawVault, vestRelease, send) |

## 📡 App API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/canopy/status` | Canopy chain connectivity + block height |
| GET | `/api/canopy/account/:addr` | Account balance from Canopy chain |
| POST | `/api/canopy/tx/lock-vault` | Submit MessageLockVault transaction |
| POST | `/api/canopy/tx/withdraw-vault` | Submit MessageWithdrawVault transaction |
| POST | `/api/canopy/tx/vest-release` | Submit MessageVestRelease transaction |
| GET | `/api/dashboard/summary` | Dashboard stats |
| GET/POST | `/api/vaults` | List & create vaults (local DB) |
| GET | `/api/vaults/:id` | Vault detail |
| GET/POST | `/api/wallets` | List & connect wallets |
| GET/POST | `/api/vesting` | Vesting schedules |
| GET/POST | `/api/liquidity` | Liquidity locks |
| GET | `/api/portfolio/summary` | Portfolio overview |
| GET | `/api/transactions` | Transaction history |

---

## 🏆 Hackathon Submission

Built for the **Canopy Network Vibe Code Contest**

- **Category:** DeFi / Web3 Infrastructure
- **Template Used:** TypeScript
- **Canopy Template:** `plugin/typescript/` (based on Canopy TypeScript plugin template)
- **One-line pitch:** Canopy Vault is an onchain DeFi vault platform that uses Canopy's TypeScript plugin to lock, vest, and release tokens with custom transaction types — enforced by the chain, not just a UI.

### What makes it truly on-chain:
1. **Custom transaction types** defined in `proto/tx.proto`: `MessageLockVault`, `MessageWithdrawVault`, `MessageVestRelease`
2. **Plugin logic** in `src/contract/contract.ts` handles `CheckTx` (validation) and `DeliverTx` (state mutation) for all three types via the Canopy FSM socket
3. **State is stored on-chain** — vault records are written to Canopy chain state as binary records, not just a database
4. **RPC integration** — the Express API server talks to Canopy RPC on ports 50002/50003 for chain queries and transaction submission
5. **UI shows chain status** — the sidebar shows live block height and "On-chain" vs "Local DB" mode

---

## 📄 License

MIT License — open source, free to use and modify.
