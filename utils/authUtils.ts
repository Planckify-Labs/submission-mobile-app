import * as LocalAuthentication from "expo-local-authentication";
import { Alert } from "react-native";

export async function authenticateUser(
  promptMessage = "Authenticate to continue",
): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      fallbackLabel: "Use passcode",
    });

    return result.success;
  } catch (error) {
    console.error("Authentication error:", error);
    Alert.alert("Error", "Authentication failed");
    return false;
  }
}
