import { getAccessToken } from "@/hooks/queries/useAuth";
import ky from "ky";

interface ApiError {
  message?: string;
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, "");
console.log("API URL:", apiUrl);

export const api = ky.create({
  prefixUrl: apiUrl,
  timeout: 30000,
  hooks: {
    beforeRequest: [
      async (request) => {
        console.log("Making API request to:", request.url);
        request.headers.set("Accept", "application/json");

        const token = await getAccessToken();
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        if (!response.ok) {
          const error = (await response.json()) as ApiError;
          console.error("API Error Response:", error);
          throw new Error(error.message || "An error occurred");
        }
        console.log("API Response Status:", response.status);
      },
    ],
  },
  retry: {
    limit: 2,
    methods: ["get"],
  },
});
