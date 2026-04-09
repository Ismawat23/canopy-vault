# Token Vault

## Overview

A DeFi token vault web application where users can deposit and lock tokens for specified periods to earn rewards. Built with React + Vite frontend and Express 5 backend in a pnpm monorepo.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Charts**: Recharts

## Features

- Dashboard with total value locked, active vaults, rewards earned, vault distribution chart, and activity feed
- Vault management: create, view, filter by status (active/matured/withdrawn)
- Vault detail with lock progress, maturity countdown, and withdrawal
- Transaction history with type filtering (deposit/withdrawal/reward)
- Automatic reward rate calculation based on lock period
- Simulated on-chain transaction hashes

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Schema

- **vaults**: id, name, token_symbol, amount, reward_rate, earned_rewards, lock_days, status, deposited_at, matures_at, withdrawn_at, created_at
- **transactions**: id, vault_id, type, token_symbol, amount, tx_hash, created_at

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
