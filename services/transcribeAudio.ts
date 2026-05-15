function resolveBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_AI_API_URL;
  if (!raw) throw new Error("EXPO_PUBLIC_AI_API_URL is not set");
  return raw.replace(/\/$/, "");
}

function resolveApiKey(): string {
  return process.env.EXPO_PUBLIC_SECRET_AI_KEY ?? "";
}

export type TranscribeResult = {
  text: string;
  language?: string;
  duration?: number;
};

export type TranscribeAudioInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export async function transcribeAudio({
  uri,
  mimeType = "audio/m4a",
  fileName = "recording.m4a",
}: TranscribeAudioInput): Promise<TranscribeResult> {
  const form = new FormData();
  // React Native FormData accepts the {uri,name,type} shape — fetch
  // streams the file from disk under the hood.
  form.append("file", {
    uri,
    name: fileName,
    type: mimeType,
  } as unknown as Blob);

  const res = await fetch(`${resolveBaseUrl()}/chat/transcribe`, {
    method: "POST",
    headers: {
      "x-api-key": resolveApiKey(),
    },
    body: form,
  });

  if (!res.ok) {
    // The server body may contain raw JSON / stack traces / API
    // configuration messages (e.g. `STT_AI_API_KEY is not set`). Keep
    // it out of the thrown message — callers surface this to end users.
    const detail = await res.text().catch(() => "");
    if (__DEV__) {
      console.warn("[transcribeAudio] failed", res.status, detail);
    }
    throw new Error("Transcription failed");
  }

  return (await res.json()) as TranscribeResult;
}
