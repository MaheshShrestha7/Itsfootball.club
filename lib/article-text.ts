// News article bodies: HTML from the rich-text editor, or plain text from articles written before it.
// Pure string helpers (no DOM), so the server (email notices) can use them too.

/** True for editor HTML; articles written before the editor are plain text (which may still say "<3" or "<Team A>") */
export const isArticleHtml = (content: string | null | undefined) =>
  /<\/?(p|br|div|span|b|strong|i|em|u|s|strike|h[1-6]|ul|ol|li|blockquote|a|img|figure|figcaption|iframe|video|hr)\b[^>]*>/i.test(content || '');

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

/** Plain text as editor HTML: blank lines split paragraphs, single newlines become <br> */
export function textToHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Any article body as editor HTML (not sanitised: see lib/article-html.ts) */
export const toArticleHtml = (content: string | null | undefined) =>
  isArticleHtml(content) ? content! : textToHtml(content || '');

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** The words of an article body, for summaries and emptiness checks */
export function articleText(content: string | null | undefined): string {
  if (!isArticleHtml(content)) return (content || '').trim();
  return content!
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/blockquote)\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#\d+|#x[\da-f]+|\w+);/gi, (m, e: string) =>
      e[0] === '#'
        ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
        : ENTITIES[e.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Nothing to publish: no words, and no picture or video either */
export const isArticleEmpty = (content: string | null | undefined) =>
  !articleText(content) && !/<(img|iframe|video)\b/i.test(content || '');
