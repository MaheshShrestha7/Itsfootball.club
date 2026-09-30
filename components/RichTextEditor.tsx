'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, Quote, AlignLeft, AlignCenter, AlignRight,
  Link2, ImagePlus, Youtube, RemoveFormatting, Loader2,
} from 'lucide-react';
import { uploadImage } from '@/components/ImageUploadZone';
import { notify } from '@/components/ConfirmDialog';
import { sanitizeArticleHtml } from '@/lib/article-html';
import { textToHtml, toArticleHtml } from '@/lib/article-text';
import { videoEmbed } from '@/lib/video';

// News article editor on the browser's own rich-text editing (contentEditable + execCommand).
// Output is HTML; everything pasted in, and everything shown publicly, goes through sanitizeArticleHtml.

const FONTS = [
  { label: 'Default font', value: 'inherit' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Sans-serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Condensed', value: '"Arial Narrow", "Roboto Condensed", sans-serif' },
  { label: 'Monospace', value: '"Courier New", monospace' },
];
// execCommand font sizes 1-7 (styled as small ... xx-large)
const SIZES = [
  { label: 'Small', value: '2' },
  { label: 'Normal', value: '3' },
  { label: 'Large', value: '5' },
  { label: 'Huge', value: '6' },
];
const BLOCKS = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading', value: 'h2' },
  { label: 'Subheading', value: 'h3' },
];

const escAttr = (s: string) => s.replace(/[&<>"']/g, c => `&#${c.charCodeAt(0)};`);

interface Props {
  id: string;
  /** Initial HTML (or legacy plain text); read once when the editor mounts */
  value: string;
  onChange: (html: string) => void;
  clubId: string;
  placeholder?: string;
}

export default function RichTextEditor({ id, value, onChange, clubId, placeholder = 'Write your story…' }: Props) {
  const editor = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editor.current) editor.current.innerHTML = sanitizeArticleHtml(toArticleHtml(value));
    // Mount only: the editor owns its content from here on
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remember where the caret was, so toolbar selects, prompts and uploads insert in the right place
  useEffect(() => {
    const save = () => {
      const sel = document.getSelection();
      if (sel?.rangeCount && editor.current?.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', save);
    return () => document.removeEventListener('selectionchange', save);
  }, []);

  const emit = () => onChange(editor.current?.innerHTML || '');

  const restore = () => {
    editor.current?.focus();
    const sel = document.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const exec = (command: string, arg?: string) => {
    restore();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, arg);
    emit();
  };

  const insertHtml = (html: string) => exec('insertHTML', html);

  const addLink = async () => {
    const url = window.prompt('Link address (https://…)')?.trim();
    if (!url) return;
    if (!/^(https?:\/\/|mailto:)/i.test(url)) return notify('That link won\'t work', 'Start it with https:// (or mailto: for an email address).');
    exec('createLink', url);
  };

  const addVideo = async () => {
    const url = window.prompt('YouTube link, or a link to an .mp4 file')?.trim();
    if (!url) return;
    const video = videoEmbed(url);
    if (!video) return notify('That video can\'t be embedded', 'Paste a YouTube link (youtube.com or youtu.be) or an https link ending in .mp4.');
    insertHtml(video.kind === 'youtube'
      ? `<iframe src="${escAttr(video.src)}"></iframe><p><br></p>`
      : `<video src="${escAttr(video.src)}"></video><p><br></p>`);
  };

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return notify('Only pictures can be added here', 'Use PNG, JPG, WebP or GIF.');
    setUploading(true);
    try {
      const url = await uploadImage(file, { folder: 'news', clubId });
      insertHtml(`<img src="${escAttr(url)}" alt=""><p><br></p>`);
    } catch (err) {
      await notify('Picture not uploaded', err instanceof Error ? err.message : undefined);
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const file = [...e.clipboardData.files].find(f => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      return addImage(file);
    }
    // Keep formatting from Word / web pages, minus anything unsafe or page-breaking
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    insertHtml(html ? sanitizeArticleHtml(html) : textToHtml(e.clipboardData.getData('text/plain')));
  };

  const onDrop = (e: React.DragEvent) => {
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    const pos = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (pos) savedRange.current = pos;
    addImage(file);
  };

  // Buttons keep the editor's selection by not taking focus on mousedown
  const btn = (label: string, icon: React.ReactNode, onClick: () => void) => (
    <button type="button" className="rte-btn" aria-label={label} title={label} onMouseDown={e => e.preventDefault()} onClick={onClick}>
      {icon}
    </button>
  );
  const select = (label: string, options: { label: string; value: string }[], run: (v: string) => void) => (
    <select className="rte-select" aria-label={label} title={label} value="" onChange={e => { run(e.target.value); e.target.value = ''; }}>
      <option value="" disabled>{label}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Formatting" aria-controls={id}>
        {select('Style', BLOCKS, v => exec('formatBlock', `<${v}>`))}
        {select('Font', FONTS, v => exec('fontName', v))}
        {select('Size', SIZES, v => exec('fontSize', v))}
        <span className="rte-sep" />
        {btn('Bold', <Bold size={16} />, () => exec('bold'))}
        {btn('Italic', <Italic size={16} />, () => exec('italic'))}
        {btn('Underline', <Underline size={16} />, () => exec('underline'))}
        {btn('Strikethrough', <Strikethrough size={16} />, () => exec('strikeThrough'))}
        <label className="rte-btn rte-color" title="Text colour" onMouseDown={() => restore()}>
          <span aria-hidden="true">A</span>
          <input type="color" aria-label="Text colour" onChange={e => exec('foreColor', e.target.value)} />
        </label>
        <span className="rte-sep" />
        {btn('Bulleted list', <List size={16} />, () => exec('insertUnorderedList'))}
        {btn('Numbered list', <ListOrdered size={16} />, () => exec('insertOrderedList'))}
        {btn('Quote', <Quote size={16} />, () => exec('formatBlock', '<blockquote>'))}
        {btn('Align left', <AlignLeft size={16} />, () => exec('justifyLeft'))}
        {btn('Align centre', <AlignCenter size={16} />, () => exec('justifyCenter'))}
        {btn('Align right', <AlignRight size={16} />, () => exec('justifyRight'))}
        <span className="rte-sep" />
        {btn('Add link', <Link2 size={16} />, addLink)}
        {btn(uploading ? 'Uploading picture…' : 'Add picture', uploading ? <Loader2 size={16} className="spin" /> : <ImagePlus size={16} />, () => fileInput.current?.click())}
        {btn('Embed video', <Youtube size={16} />, addVideo)}
        {btn('Clear formatting', <RemoveFormatting size={16} />, () => exec('removeFormat'))}
        <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={e => addImage(e.target.files?.[0])} />
      </div>
      <div
        id={id}
        ref={editor}
        className="rte-body article-body"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={emit}
        onBlur={emit}
        onPaste={onPaste}
        onDrop={onDrop}
      />
    </div>
  );
}
