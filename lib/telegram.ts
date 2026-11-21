// Itsfootball.club Bot on Telegram (server only). Needs TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and
// TELEGRAM_WEBHOOK_SECRET (long random text of letters, numbers, _ and - only: Telegram sends it back on every update, so only
// Telegram can call our webhook).

export const telegramConfigured = () =>
  !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);

/** The one-time link a member taps to link their chat */
export const telegramStartLink = (code: string) =>
  `https://t.me/${(process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '')}?start=${code}`;

async function call(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; description?: string; result?: unknown }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, description: 'TELEGRAM_BOT_TOKEN is not set' };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000), // Telegram can be slow to answer from some Cloudflare locations
    });
    return await res.json();
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : 'network error' };
  }
}

// Telegram's limit for a button's data is 64 bytes, not characters
const upTo64Bytes = (s: string) => { let d = s; while (new TextEncoder().encode(d).length > 64) d = d.slice(0, -1); return d; };

/** A reply, with optional buttons under it (each button sends its own text back as if typed) */
export async function sendTelegram(chatId: string, text: string, buttons?: string[]) {
  const reply_markup = buttons?.length
    // Short buttons sit in one row; long ones (the game list) get a row each
    ? { inline_keyboard: buttons.some(b => b.length > 16) ? buttons.slice(0, 8).map(b => [{ text: b, callback_data: upTo64Bytes(b) }]) : [buttons.slice(0, 4).map(b => ({ text: b, callback_data: upTo64Bytes(b) }))] }
    : undefined;
  const r = await call('sendMessage', { chat_id: chatId, text, reply_markup, link_preview_options: { is_disabled: true } });
  if (!r.ok) console.error('[telegram] sendMessage failed:', r.description);
}

/** Stops the spinner on a tapped button */
export const answerTelegramButton = (id: string) => call('answerCallbackQuery', { callback_query_id: id });

/** Points Telegram at our webhook (Mission Control -> AI and chat -> Connect the bot) */
export const setTelegramWebhook = (url: string) =>
  call('setWebhook', { url, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates: ['message', 'callback_query'], drop_pending_updates: true });
