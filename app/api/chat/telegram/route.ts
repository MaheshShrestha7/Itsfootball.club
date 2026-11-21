import { NextRequest, NextResponse } from 'next/server';
import { getServiceClient } from '@/lib/supabase/service';
import { answerTelegramButton, pinTelegram, sendTelegram, telegramConfigured } from '@/lib/telegram';
import { handleChatMessage } from '@/lib/chat-bot-server';
import { rememberBoard } from '@/lib/chat-board';
import { senderName } from '@/lib/chat-join';

// Itsfootball.club Bot: Telegram sends every message and button tap here (set up from Mission Control
// -> AI and chat -> Connect the bot). Only Telegram knows TELEGRAM_WEBHOOK_SECRET, which it sends back
// in a header, so nobody else can post scores through this route. Private chats only.
// Always answers 200, or Telegram keeps re-sending the same update.

export async function POST(req: NextRequest) {
  if (!telegramConfigured()) return NextResponse.json({ error: 'Not set up.' }, { status: 404 });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
  }
  const update = await req.json().catch(() => null);
  const button = update?.callback_query;
  const message = button?.message || update?.message;
  const chat = message?.chat;
  const text: unknown = button ? button.data : update?.message?.text;
  if (button?.id) await answerTelegramButton(String(button.id));
  if (!chat || chat.type !== 'private' || typeof text !== 'string') return NextResponse.json({ ok: true });

  const chatId = String(chat.id);
  const db = getServiceClient();
  if (!db) {
    await sendTelegram(chatId, "Score by chat isn't available right now.");
    return NextResponse.json({ ok: true });
  }
  try {
    const replies = await handleChatMessage(db, chatId, text, new Date(), senderName(button?.from || update?.message?.from));
    for (const r of replies) {
      const id = await sendTelegram(chatId, r.text, r.buttons);
      // The live scoreboard: pinned at the top, and remembered so later changes rewrite it
      if (r.board && id) {
        await pinTelegram(chatId, id);
        await rememberBoard(db, r.board.linkId, r.board.matchId, id);
      }
    }
  } catch (e) {
    console.error('[chat/telegram] failed:', e);
    await sendTelegram(chatId, 'Something went wrong on our side. Check Match Centre before sending it again.');
  }
  return NextResponse.json({ ok: true });
}
