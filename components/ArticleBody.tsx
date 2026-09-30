'use client';

import { useMemo } from 'react';
import { sanitizeArticleHtml } from '@/lib/article-html';
import { isArticleHtml } from '@/lib/article-text';

/** A news article's body: editor HTML (sanitised), or the plain text of articles written before the editor */
export default function ArticleBody({ content, style }: { content: string; style?: React.CSSProperties }) {
  const html = useMemo(() => (isArticleHtml(content) ? sanitizeArticleHtml(content) : null), [content]);
  if (html === null) return <div style={{ whiteSpace: 'pre-line', ...style }}>{content}</div>;
  return <div className="article-body" style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}
