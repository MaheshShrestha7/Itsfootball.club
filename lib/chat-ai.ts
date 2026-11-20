// Score by chat: the AI that reads messages not in the short format (server only).
// Gemini 3.1 Flash-Lite first, Gemma 4 when Flash-Lite is busy, fails or is at its limit.
// Both on Google's free tier with GEMINI_API_KEY. On the free tier Google may use what we send, so
// callers send only the message and the squad's first names, and never for junior teams.
import { AI_SYSTEM, aiPrompt, parseAiReply, type ChatCommand } from './chat-score';

export const AI_MODELS = {
  'flash-lite': process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite',
  gemma: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
} as const;
export type AiReader = keyof typeof AI_MODELS;

export const aiConfigured = () => !!process.env.GEMINI_API_KEY;

/** One model's raw answer, or an error message */
export async function askModel(reader: AiReader, text: string, names: string[]): Promise<{ text?: string; error?: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { error: 'GEMINI_API_KEY is not set' };
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${AI_MODELS[reader]}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: aiPrompt(text, names) }] }],
        generationConfig: { maxOutputTokens: 200, thinkingConfig: { thinkingLevel: 'minimal' } },
      }),
      signal: AbortSignal.timeout(15000),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) return { error: `${res.status} ${json?.error?.message || ''}`.trim().slice(0, 200) };
    const out = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
    return out ? { text: out } : { error: 'empty answer' };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'network error' };
  }
}

/**
 * Reads one message with the first reader allowed (`readers`, in order). Returns the command and who
 * read it, or null when none could. An error moves on to the next model.
 */
export async function readWithAi(text: string, names: string[], readers: AiReader[]): Promise<{ command: ChatCommand | null; reader: AiReader | null; error: boolean }> {
  let error = false;
  for (const reader of readers) {
    const r = await askModel(reader, text, names);
    if (r.error) {
      console.error(`[chat-ai] ${reader} failed:`, r.error);
      error = true;
      continue;
    }
    return { command: parseAiReply(r.text || ''), reader, error };
  }
  return { command: null, reader: null, error };
}
