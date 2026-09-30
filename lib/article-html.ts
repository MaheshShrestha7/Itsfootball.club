// Sanitising news article HTML (browser only: DOMPurify needs a DOM). Articles are written by club
// admins and shown to the public, so only formatting survives: no scripts, handlers or forms, CSS
// limited to text styling, pictures over https, and videos only as YouTube (nocookie) or https .mp4.
import DOMPurify from 'dompurify';
import { videoEmbed } from '@/lib/video';

const TAGS = ['p', 'br', 'div', 'span', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'h2', 'h3', 'h4', 'ul', 'ol', 'li',
  'blockquote', 'a', 'img', 'figure', 'figcaption', 'iframe', 'video', 'hr'];
const ATTRS = ['href', 'src', 'alt', 'title', 'style'];
const STYLE_PROPS = ['color', 'background-color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-decoration-line', 'text-align'];

export function sanitizeArticleHtml(html: string): string {
  if (typeof window === 'undefined') return '';
  const frag = DOMPurify.sanitize(html, { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, RETURN_DOM_FRAGMENT: true });

  // Text styling only (no url(), positioning or sizes that could cover the page)
  frag.querySelectorAll<HTMLElement>('[style]').forEach(el => {
    const kept = STYLE_PROPS
      .map(p => [p, el.style.getPropertyValue(p)] as const)
      .filter(([, v]) => v && !/url\(|expression|var\(/i.test(v))
      .map(([p, v]) => `${p}: ${v}`)
      .join('; ');
    if (kept) el.setAttribute('style', kept);
    else el.removeAttribute('style');
  });

  frag.querySelectorAll('a').forEach(a => {
    if (!/^(https?:|mailto:)/i.test(a.getAttribute('href') || '')) a.removeAttribute('href');
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer nofollow');
  });

  frag.querySelectorAll('img').forEach(img => {
    if (!/^https:\/\//i.test(img.getAttribute('src') || '')) return img.remove();
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });

  // Rebuilt from the link, so nothing else on the element survives
  frag.querySelectorAll('iframe, video').forEach(el => {
    const video = videoEmbed(el.getAttribute('src'));
    if (!video || (video.kind === 'youtube') !== (el.tagName === 'IFRAME')) return el.remove();
    const clean = document.createElement(el.tagName.toLowerCase());
    clean.setAttribute('src', video.src);
    if (video.kind === 'youtube') {
      clean.setAttribute('title', 'Video');
      clean.setAttribute('loading', 'lazy');
      clean.setAttribute('allow', 'accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen');
      clean.setAttribute('allowfullscreen', '');
      clean.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    } else {
      clean.setAttribute('controls', '');
      clean.setAttribute('preload', 'metadata');
    }
    el.replaceWith(clean);
  });

  const out = document.createElement('div');
  out.append(frag);
  return out.innerHTML;
}
