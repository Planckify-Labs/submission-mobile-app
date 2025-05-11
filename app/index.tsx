import { Stack } from "expo-router";
import { english, generateMnemonic, generatePrivateKey } from 'viem/accounts';

export default function RootLayout() {
  const privateKey = generatePrivateKey()
  console.log({privateKey})
  
  const mnemonic = generateMnemonic(english)
  console.log({mnemonic})
  return <Stack />;
}
