# 🌿 Canopy Vault

> **Canopy Vault is a multi-chain DeFi security platform that lets you lock, vest, and track tokens across Ethereum, Polygon, BSC, and more — with smart contract-grade protection and real-time portfolio insights.**

---

## 📸 Preview

![Canopy Vault Dashboard](artifacts/token-vault/public/canopy-vault-logo.png)

---

## ✨ Features

| Feature | Description |
|--------|-------------|
| 🔒 **Token Vault Locking** | Lock tokens for 30–365+ days and earn up to 14% APY rewards |
| 📅 **Vesting Schedules** | Create linear token release schedules with custom cliff periods |
| 🌐 **Multi-Chain Support** | Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche |
| 📊 **Portfolio Tracker** | Real-time charts for value by chain and token allocation |
| 💧 **Liquidity Locking** | Lock LP tokens across Uniswap, PancakeSwap, QuickSwap, and more |
| 👛 **Wallet Management** | Connect and track wallets with balances across all chains |

---

## 🏗️ Tech Stack

- **Frontend:** React + Vite + TypeScript
- **Backend:** Express.js + TypeScript
- **Database:** PostgreSQL (via Drizzle ORM)
- **API:** OpenAPI 3.0 with auto-generated client & Zod validators
- **Charts:** Recharts
- **UI:** Tailwind CSS + shadcn/ui

---

## 📁 Project Structure

```
canopy-vault/
├── artifacts/
│   ├── api-server/          # Express backend API
│   └── token-vault/         # React + Vite frontend
├── lib/
│   ├── api-spec/            # OpenAPI specification
│   ├── api-client-react/    # Auto-generated React Query hooks
│   ├── api-zod/             # Auto-generated Zod validators
│   └── db/                  # Drizzle ORM schema & migrations
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- pnpm
- PostgreSQL database

### Installation

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/canopy-vault.git
cd canopy-vault

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Add your DATABASE_URL and SESSION_SECRET to .env

# Push database schema
pnpm --filter @workspace/db run db:push

# Seed initial data
pnpm --filter @workspace/db run seed
```

### Running Locally

```bash
# Start the API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Start the frontend (in a separate terminal)
pnpm --filter @workspace/token-vault run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🔒 Reward Rates by Lock Period

| Lock Duration | APY Reward |
|--------------|-----------|
| ≤ 30 days | 3.5% |
| ≤ 90 days | 5.2% |
| ≤ 180 days | 7.8% |
| ≤ 365 days | 10.5% |
| 365+ days | 14.0% |

---

## 🌐 Supported Networks

- Ethereum (ETH)
- Polygon (MATIC)
- BNB Smart Chain (BNB)
- Arbitrum (ARB)
- Optimism (OP)
- Avalanche (AVAX)

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Dashboard stats |
| GET/POST | `/api/vaults` | List & create vaults |
| GET | `/api/vaults/:id` | Vault detail |
| GET/POST | `/api/wallets` | List & connect wallets |
| GET/POST | `/api/vesting` | Vesting schedules |
| GET/POST | `/api/liquidity` | Liquidity locks |
| GET | `/api/portfolio/summary` | Portfolio overview |
| GET | `/api/transactions` | Transaction history |

---

## 🏆 Hackathon Submission

Built for the **Canopy Network Hackathon**

- **Category:** DeFi / Web3 Infrastructure
- **Template Used:** TypeScript
- **One-line pitch:** Canopy Vault is a multi-chain DeFi security platform that lets you lock, vest, and track tokens across Ethereum, Polygon, BSC, and more — with smart contract-grade protection and real-time portfolio insights.

---

## 📄 License

MIT License — open source, free to use and modify.
