# DTO Pattern Examples

## Example 1: Refactoring Component Props

### Before (Anti-pattern)

```typescript
// components/WalletCard.tsx
type WalletCardProps = {
  address: string;
  balance: string;
  name: string;
  network: Network;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

function WalletCard({
  address,
  balance,
  name,
  network,
  isSelected,
  onSelect,
  onDelete,
}: WalletCardProps) {
  return (
    <Pressable onPress={onSelect}>
      <Text>{name}</Text>
      <Text>{address}</Text>
      <Text>{balance} on {network.name}</Text>
      {isSelected && <CheckIcon />}
      <DeleteButton onPress={onDelete} />
    </Pressable>
  );
}

// Usage - hard to read
<WalletCard
  address={wallet.address}
  balance={wallet.balance}
  name={wallet.name}
  network={wallet.network}
  isSelected={selectedId === wallet.id}
  onSelect={() => handleSelect(wallet)}
  onDelete={() => handleDelete(wallet.id)}
/>
```

### After (DTO Pattern)

```typescript
// types/dto/wallet.dto.ts
export type WalletDTO = {
  id: string;
  address: string;
  balance: string;
  name: string;
  network: Network;
};

// components/WalletCard.tsx
type WalletCardProps = {
  wallet: WalletDTO;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
};

function WalletCard({
  wallet,
  isSelected,
  onSelect,
  onDelete,
}: WalletCardProps) {
  const { address, balance, name, network } = wallet;

  return (
    <Pressable onPress={onSelect}>
      <Text>{name}</Text>
      <Text>{address}</Text>
      <Text>{balance} on {network.name}</Text>
      {isSelected && <CheckIcon />}
      <DeleteButton onPress={onDelete} />
    </Pressable>
  );
}

// Usage - clean and readable
<WalletCard
  wallet={wallet}
  isSelected={selectedId === wallet.id}
  onSelect={() => handleSelect(wallet)}
  onDelete={() => handleDelete(wallet.id)}
/>
```

## Example 2: Refactoring Function Parameters

### Before (Anti-pattern)

```typescript
// services/transactionService.ts
async function createTransaction(
  fromAddress: Address,
  toAddress: Address,
  amount: bigint,
  tokenAddress: Address,
  chainId: number,
  gasPrice?: bigint,
  gasLimit?: bigint,
  nonce?: number,
  data?: Hex
): Promise<Transaction> {
  // Hard to remember parameter order
  // Easy to mix up fromAddress and toAddress
}

// Usage - error prone
await createTransaction(
  '0x123...',
  '0x456...',
  BigInt(1000),
  '0x789...',
  1,
  undefined,
  BigInt(21000),
  undefined,
  '0x'
);
```

### After (DTO Pattern)

```typescript
// types/dto/transaction.dto.ts
export type CreateTransactionParams = {
  from: Address;
  to: Address;
  amount: bigint;
  tokenAddress: Address;
  chainId: number;
  gasPrice?: bigint;
  gasLimit?: bigint;
  nonce?: number;
  data?: Hex;
};

// services/transactionService.ts
async function createTransaction(
  params: CreateTransactionParams
): Promise<Transaction> {
  const {
    from,
    to,
    amount,
    tokenAddress,
    chainId,
    gasPrice,
    gasLimit = BigInt(21000),
    nonce,
    data,
  } = params;
  // Clear what each value represents
}

// Usage - self-documenting
await createTransaction({
  from: '0x123...',
  to: '0x456...',
  amount: BigInt(1000),
  tokenAddress: '0x789...',
  chainId: 1,
  gasLimit: BigInt(21000),
  data: '0x',
});
```

## Example 3: Refactoring Hook Parameters

### Before (Anti-pattern)

```typescript
// hooks/useSwapQuote.ts
function useSwapQuote(
  tokenIn: Address,
  tokenOut: Address,
  amountIn: bigint,
  slippage: number,
  chainId: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['swap', 'quote', tokenIn, tokenOut, amountIn.toString()],
    queryFn: () => fetchQuote(tokenIn, tokenOut, amountIn, slippage),
    enabled,
  });
}

// Usage
const { data } = useSwapQuote(
  '0xtoken1...',
  '0xtoken2...',
  BigInt(1000),
  0.5,
  1,
  isReady
);
```

### After (DTO Pattern)

```typescript
// types/dto/swap.dto.ts
export type SwapQuoteConfig = {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  slippage: number;
  chainId: number;
  enabled?: boolean;
};

// hooks/useSwapQuote.ts
function useSwapQuote(config: SwapQuoteConfig) {
  const {
    tokenIn,
    tokenOut,
    amountIn,
    slippage,
    chainId,
    enabled = true,
  } = config;

  return useQuery({
    queryKey: ['swap', 'quote', tokenIn, tokenOut, amountIn.toString()],
    queryFn: () => fetchQuote({ tokenIn, tokenOut, amountIn, slippage }),
    enabled,
  });
}

// Usage - explicit and clear
const { data } = useSwapQuote({
  tokenIn: '0xtoken1...',
  tokenOut: '0xtoken2...',
  amountIn: BigInt(1000),
  slippage: 0.5,
  chainId: 1,
  enabled: isReady,
});
```

## Example 4: API Request/Response DTOs

```typescript
// types/dto/booking.dto.ts
export type CreateBookingRequest = {
  productId: string;
  quantity: number;
  paymentMethod: 'crypto' | 'fiat';
  walletAddress: Address;
  metadata?: {
    notes?: string;
    referralCode?: string;
  };
};

export type CreateBookingResponse = {
  bookingId: string;
  status: BookingStatus;
  totalAmount: string;
  expiresAt: string;
  paymentDetails: {
    address: Address;
    amount: bigint;
    token: Token;
  };
};

// services/bookingService.ts
async function createBooking(
  request: CreateBookingRequest
): Promise<CreateBookingResponse> {
  const response = await api.post('/bookings', request);
  return response.data;
}
```

## Example 5: Nested DTOs for Complex Data

```typescript
// types/dto/order.dto.ts
export type OrderItemDTO = {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: string;
};

export type ShippingInfoDTO = {
  address: string;
  city: string;
  country: string;
  postalCode: string;
};

export type PaymentInfoDTO = {
  method: 'crypto' | 'card';
  walletAddress?: Address;
  transactionHash?: Hash;
};

export type OrderDTO = {
  id: string;
  items: OrderItemDTO[];
  shipping: ShippingInfoDTO;
  payment: PaymentInfoDTO;
  status: OrderStatus;
  createdAt: string;
};

// components/OrderSummary.tsx
type OrderSummaryProps = {
  order: OrderDTO;
  onCancel?: () => void;
};

function OrderSummary({ order, onCancel }: OrderSummaryProps) {
  const { items, shipping, payment, status } = order;
  // Clean access to nested data
}
```

## Quick Reference: When to Refactor

| Situation | Action |
|-----------|--------|
| Function has 4+ params | Create `{Function}Params` type |
| Component has 4+ props | Group related props into DTOs |
| Hook takes 4+ config values | Create `Use{Hook}Config` type |
| Same data structure used in multiple places | Extract to shared DTO |
| API endpoint request/response | Always use typed DTOs |
