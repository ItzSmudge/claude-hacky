import { NextResponse } from "next/server";
import { z } from "zod";
import type { ApiError } from "@/lib/api-schemas";
import { TTS_MAX_TEXT } from "@/components/a11y/speech";
import { serverEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

// Owner: a11y (AX-02). GET ?text=… → MP3 from ElevenLabs, streamed. A GET so the client can point
// an <audio> element straight at it inside the click, which iOS Safari needs to allow playback.
// Any failure here just means the Listen button falls back to the device voice.

export const maxDuration = 30;
const DEADLINE_MS = 20_000;

const querySchema = z.object({ text: z.string().trim().min(1).max(TTS_MAX_TEXT) });

const error = (status: number, message: string) =>
  NextResponse.json<ApiError>({ error: message }, { status });

export async function GET(request: Request) {
  const { ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID, ELEVENLABS_MODEL_ID } = serverEnv();
  if (!ELEVENLABS_API_KEY) return error(503, "Read aloud voice isn't set up");

  // Members only: every call spends ElevenLabs characters.
  const supabase = await getSupabaseServerClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims.sub) return error(401, "Sign in first");

  const parsed = querySchema.safeParse({
    text: new URL(request.url).searchParams.get("text") ?? "",
  });
  if (!parsed.success) return error(400, "Invalid request");

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(ELEVENLABS_VOICE_ID)}/stream?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: parsed.data.text,
        model_id: ELEVENLABS_MODEL_ID,
        language_code: "en",
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1 },
      }),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(DEADLINE_MS)]),
    },
  ).catch((err: unknown) => {
    console.error("[tts] request failed", err instanceof Error ? err.name : typeof err);
    return null;
  });

  if (!upstream?.ok || !upstream.body) {
    if (upstream) console.error("[tts] ElevenLabs returned", upstream.status);
    return error(502, "Couldn't voice that text");
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "audio/mpeg",
      // Same text, same audio: replaying a card shouldn't spend characters twice.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
