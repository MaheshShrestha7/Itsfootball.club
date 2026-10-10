'use client';

import { useEffect, useMemo, useState } from 'react';
import { sanitizeArticleHtml } from '@/lib/article-html';
import { articleText, isArticleHtml } from '@/lib/article-text';

/** A news article's body: editor HTML (sanitised), or the plain text of articles written before the editor */
export default function ArticleBody({ content, style }: { content: string; style?: React.CSSProperties }) {
  // Sanitising needs the browser's DOM, so the server (and the first paint, to match it) shows the words only
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const html = useMemo(() => (mounted && isArticleHtml(content) ? sanitizeArticleHtml(content) : null), [mounted, content]);

  if (html !== null) return <div className="article-body" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
  if (!isArticleHtml(content)) return <div style={{ whiteSpace: 'pre-line', ...style }}>{content}</div>;
  // Paragraph text as React text nodes (escaped), so crawlers that don't run JavaScript still read the article
  const paragraphs = content.split(/<\/(?:p|div|h[1-6]|li|blockquote)>|<br\s*\/?>/i).map(articleText).filter(Boolean);
  return (
    <div className="article-body" style={style}>
      {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}
