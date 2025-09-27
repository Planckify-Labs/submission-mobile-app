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
