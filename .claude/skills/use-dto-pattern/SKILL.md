---
name: use-dto-pattern
description: Use DTO (Data Transfer Object) pattern when passing more than 3 parameters. Applies to component props, function arguments, and hook parameters for better maintainability and type safety.
---

# Use DTO Pattern for Multiple Parameters

When a function, component, or hook requires more than 3 parameters, group them into a single DTO (Data Transfer Object) type.

## When to Use

1. **Component props with 4+ properties** - Create a Props type/interface
2. **Functions with 4+ parameters** - Use an options/params object
3. **Hook parameters with 4+ values** - Group into a config object
4. **API request/response data** - Always use typed DTOs

## Rule: Maximum 3 Individual Parameters

```typescript
// BAD: More than 3 parameters
function processTransaction(
  amount: string,
  recipient: string,
  token: Token,
  network: Network,
  memo?: string
) { ... }

// GOOD: Group into DTO
type ProcessTransactionParams = {
  amount: string;
  recipient: string;
  token: Token;
  network: Network;
  memo?: string;
};

function processTransaction(params: ProcessTransactionParams) {
  const { amount, recipient, token, network, memo } = params;
  // ...
}
```

## Component Props Pattern

```typescript
// BAD: Too many individual props
type TransactionCardProps = {
  amount: string;
  recipient: string;
  token: Token;
  timestamp: Date;
  status: TransactionStatus;
  onPress: () => void;
};

function TransactionCard({
  amount,
  recipient,
  token,
  timestamp,
  status,
  onPress,
}: TransactionCardProps) { ... }

// GOOD: Group related data into DTOs
type Transaction = {
  amount: string;
  recipient: string;
  token: Token;
  timestamp: Date;
  status: TransactionStatus;
};

type TransactionCardProps = {
  transaction: Transaction;
  onPress: () => void;
};

function TransactionCard({ transaction, onPress }: TransactionCardProps) {
  const { amount, recipient, token, timestamp, status } = transaction;
  // ...
}
```

## Function Parameters Pattern

```typescript
// BAD: Long parameter list
async function sendTransaction(
  from: Address,
  to: Address,
  amount: bigint,
  token: Token,
  gasLimit: bigint,
  nonce: number
): Promise<TransactionHash> { ... }

// GOOD: Use params object
type SendTransactionParams = {
  from: Address;
  to: Address;
  amount: bigint;
  token: Token;
  gasLimit?: bigint;
  nonce?: number;
};

async function sendTransaction(
  params: SendTransactionParams
): Promise<TransactionHash> {
  const { from, to, amount, token, gasLimit, nonce } = params;
  // ...
}
```

## Hook Parameters Pattern

```typescript
// BAD: Multiple hook parameters
function useTokenBalance(
  address: Address,
  tokenAddress: Address,
  chainId: number,
  enabled: boolean
) { ... }

// GOOD: Config object
type UseTokenBalanceConfig = {
  address: Address;
  tokenAddress: Address;
  chainId: number;
  enabled?: boolean;
};

function useTokenBalance(config: UseTokenBalanceConfig) {
  const { address, tokenAddress, chainId, enabled = true } = config;
  // ...
}
```

## DTO Naming Conventions

| Context | Naming Pattern | Example |
|---------|---------------|---------|
| Component props | `{Component}Props` | `TransactionCardProps` |
| Function params | `{Function}Params` | `SendTransactionParams` |
| Hook config | `Use{Hook}Config` | `UseTokenBalanceConfig` |
| API request | `{Action}Request` | `CreateBookingRequest` |
| API response | `{Action}Response` | `CreateBookingResponse` |

## DTO Location

Define DTOs close to where they're used:

```
types/
├── dto/
│   ├── transaction.dto.ts    # Transaction-related DTOs
│   ├── wallet.dto.ts         # Wallet-related DTOs
│   └── booking.dto.ts        # Booking-related DTOs
```

Or co-locate with the module:

```
features/
├── transactions/
│   ├── types.ts              # DTOs for this feature
│   ├── TransactionCard.tsx
│   └── useTransaction.ts
```

## Benefits

1. **Readability** - Clear parameter names at call site
2. **Maintainability** - Add/remove fields without changing function signature
3. **Type Safety** - Single source of truth for parameter types
4. **Destructuring** - Easy to extract only needed values
5. **Optional Parameters** - Clean defaults with destructuring

## Additional Resources

- For examples, see [examples.md](examples.md)
