import * as Clipboard from "expo-clipboard";
import { Alert } from "react-native";

export async function copyToClipboard(
  text: string,
  label: string,
): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    Alert.alert("Copied", `${label} copied to clipboard`);
    return true;
  } catch (error) {
    console.error("Clipboard error:", error);
    Alert.alert("Error", "Failed to copy to clipboard");
    return false;
  }
}

export function formatTokenAmount(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;

  if (isNaN(num) || num === 0) {
    return "0";
  }

  const absNum = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (absNum < 0.01) {
    const str = absNum.toFixed(10);
    const match = str.match(/0\.(0*)([1-9]\d?)/);
    if (match) {
      const zeros = match[1].length;
      const significantDigits = match[2];
      return `${sign}0.${"0".repeat(zeros)}${significantDigits}`;
    }
    return `${sign}${absNum.toFixed(6)}`.replace(/\.?0+$/, "");
  }

  if (absNum < 1) {
    return `${sign}${absNum.toFixed(1)}`;
  }

  if (absNum < 100) {
    return `${sign}${absNum.toFixed(1)}`;
  }

  if (absNum < 1000) {
    return `${sign}${Math.round(absNum)}`;
  }

  if (absNum < 1_000_000) {
    const thousands = absNum / 1000;
    if (thousands >= 100) {
      return `${sign}${Math.round(thousands)}K`;
    }
    if (thousands >= 10) {
      return `${sign}${Math.round(thousands)}K`;
    }
    return `${sign}${thousands.toFixed(1)}K`;
  }

  if (absNum < 1_000_000_000) {
    const millions = absNum / 1_000_000;
    if (millions >= 100) {
      return `${sign}${Math.round(millions)}M`;
    }
    if (millions >= 10) {
      return `${sign}${Math.round(millions)}M`;
    }
    if (absNum % 1_000_000 === 0) {
      return `${sign}${Math.round(millions)}M`;
    }
    return `${sign}${millions.toFixed(1)}M`.replace(/\.0M$/, "M");
  }

  const billions = absNum / 1_000_000_000;
  if (billions >= 100) {
    return `${sign}${Math.round(billions)}B`;
  }
  if (billions >= 10) {
    return `${sign}${Math.round(billions)}B`;
  }
  if (absNum % 1_000_000_000 === 0) {
    return `${sign}${Math.round(billions)}B`;
  }
  return `${sign}${billions.toFixed(1)}B`.replace(/\.0B$/, "B");
}
