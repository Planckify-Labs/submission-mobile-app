# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development
pnpm start                    # Start Expo dev server
pnpm android                  # Run on Android emulator
pnpm ios                      # Run on iOS simulator

# Code Quality
pnpm lint                     # Run Expo lint
pnpm check:syntax             # TypeScript type checking
pnpm biome:check              # Run Biome formatter with auto-fix

# Building (EAS)
eas build --platform android --profile development
eas build --platform ios --profile development
eas build --platform android --profile production
```

## Architecture Overview

### Tech Stack
- **Framework:** React Native with Expo 54 (Hermes engine, New Architecture enabled)
- **Routing:** Expo Router (file-based routing in `/app`)
- **State Management:** TanStack React Query v5 for server state
- **Styling:** NativeWind (Tailwind CSS for React Native)
- **Blockchain:** Viem for Ethereum/EVM chain interactions
- **AI Agent:** Vercel AI SDK with Anthropic integration
- **Package Manager:** pnpm

### Key Directories
- `app/` - File-based routing screens (Expo Router)
- `components/` - Reusable UI components organized by feature
- `hooks/` - Custom React hooks, including `hooks/queries/` for data fetching
- `services/` - Business logic (walletService.ts, ethereumProvider.ts)
- `api/` - API endpoints and types
- `constants/` - Chain configs, query keys, app constants

### State Management Pattern

**TanStack Query** handles server state with these defaults:
- `staleTime: 60 * 1000`
- `retry: 1`
- `refetchOnWindowFocus: false`

**Global state** uses custom `useRQGlobalState` hook backed by React Query.

### Core Hooks

**useWallet** (`hooks/useWallet.ts`) - Central wallet state management:
- Multi-wallet support with active wallet tracking
- Chain switching across EVM networks
- Secure storage via `expo-secure-store`
- Viem client creation for blockchain interactions

**Query hooks** (`hooks/queries/`) - Data fetching for auth, blockchains, dapps, products, tokens, transactions.

### DApps Browser

The DApps browser (`components/dapps-browser/`) implements an EIP-1193 compatible Ethereum provider (`services/ethereumProvider.ts`) for MetaMask-like wallet injection.

### AI Agent Mode

Located in `components/home/TakumiAgent/`:
- Uses `@ai-sdk/react` useChat hook
- API endpoint configured via `EXPO_PUBLIC_AI_API_URL`
- Supports tool calls, markdown rendering, conversation history

## Code Style

- **Formatter:** Biome (spaces, double quotes)
- **Linting:** ESLint with expo config + Biome rules
- **TypeScript:** Strict mode, path alias `@/*` maps to root

## Environment Variables

Key variables (see `.env.example`):
- `EXPO_PUBLIC_API_URL` - Backend API
- `EXPO_PUBLIC_AI_API_URL` - AI agent endpoint
- `EXPO_PUBLIC_SECRET_AI_KEY` - AI API key
- Provider IDs for mobile data purchase

## Git Workflow

- **Main branch:** main
- **Development:** dev
- **Commit format:** `type(scope): description` (e.g., `feat(wallet): add multi-sig`)
- **Types:** feat, fix, refactor, chore, docs

## Known Technical Debt

From `docs/todolist/technical-deb.md`:
1. `activeChain` chainId fetching is inefficient - should store chainIdFromDb directly in state instead of re-fetching all blockchains
