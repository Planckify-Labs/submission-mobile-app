import * as LocalAuthentication from "expo-local-authentication";

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
    console.error("Error: Authentication failed");
    return false;
  }
}
