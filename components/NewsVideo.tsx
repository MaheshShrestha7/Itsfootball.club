import React from 'react';
import { videoEmbed } from '@/lib/video';

/** A news article's video (YouTube or .mp4); renders nothing for a missing or unsupported link */
export default function NewsVideo({ url, title }: { url?: string; title: string }) {
  const video = videoEmbed(url);
  if (!video) return null;
  const style: React.CSSProperties = { width: '100%', aspectRatio: '16 / 9', border: 'none', borderRadius: '12px', marginBottom: '1.5rem', background: '#000' };
  return video.kind === 'youtube' ? (
    <iframe
      src={video.src}
      title={`Video: ${title}`}
      loading="lazy"
      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin"
      style={style}
    />
  ) : (
    <video src={video.src} controls preload="metadata" style={style} aria-label={`Video: ${title}`} />
  );
}
