export type VideoEmbed = { kind: 'youtube' | 'mp4'; src: string };

/**
 * A news article's video link as something safe to embed: any YouTube link becomes a
 * youtube-nocookie embed, an https .mp4 plays in a <video>. Anything else is ignored.
 */
export function videoEmbed(url: string | undefined | null): VideoEmbed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== 'https:') return null;

  const host = u.hostname.replace(/^(www\.|m\.)/, '');
  let id: string | null | undefined = null;
  if (host === 'youtu.be') id = u.pathname.slice(1);
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = u.searchParams.get('v') || u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1];
  }
  if (id && /^[\w-]{6,20}$/.test(id)) return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };

  if (/\.mp4$/i.test(u.pathname)) return { kind: 'mp4', src: u.href };
  return null;
}
