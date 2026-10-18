'use client';

// The Free Tools menu in the platform header: a panel of the tools by group on desktop (opens on hover,
// or with the arrow button from the keyboard) and an expandable list in the phone menu. The "Free Tools"
// link itself still goes to /tools. Built from lib/tool-pages.ts, so a new tool shows up here too.
import { useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, ChevronDown, Wrench } from 'lucide-react';
import { useEscapeToClose } from '@/lib/use-escape-to-close';
import { GROUNDS_LINK, TOOL_GROUPS, TOOLS_HUB, TOURNAMENT_FORMAT_PAGES, type ToolPageLink } from '@/lib/tool-pages';
import { TOOL_GROUP_ICONS } from '@/components/tool-group-icons';

// Besides each group's main tools: the tournament formats people search for by name, and the grounds directory
const EXTRAS: Record<string, ToolPageLink[]> = { tournaments: TOURNAMENT_FORMAT_PAGES, 'club-admin': [GROUNDS_LINK] };

/** "Football lineup builder" → "Lineup builder": the menu is already about football */
const menuName = (label: string) => {
  const s = label.replace(/^(Football|Soccer|Match) /, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const MENU_GROUPS = TOOL_GROUPS.map(g => ({ ...g, links: [...g.main, ...(EXTRAS[g.id] ?? [])], ...TOOL_GROUP_ICONS[g.id] }));

const navLinkStyle = { color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.4rem' } as const;

export function ToolsMenuDesktop() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEscapeToClose(open, setOpen);
  return (
    <div
      ref={wrap}
      className="tools-menu"
      style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
      onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) setOpen(true); }}
      onMouseLeave={() => setOpen(false)}
      onBlur={e => { if (!wrap.current?.contains(e.relatedTarget as Node | null)) setOpen(false); }}
    >
      <Link href={TOOLS_HUB.path} style={navLinkStyle} onClick={() => setOpen(false)}>
        <Wrench size={16} />
        Free Tools
      </Link>
      <button
        type="button"
        className="tools-menu-toggle"
        aria-expanded={open}
        aria-controls="tools-menu-panel"
        aria-label="Show the free tools"
        onClick={() => setOpen(o => !o)}
      >
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
      {/* Always rendered (hidden when closed) so the links are in the page for crawlers too */}
      <div id="tools-menu-panel" className="tools-menu-panel" hidden={!open}>
        <div className="tools-menu-groups">
          {MENU_GROUPS.map(g => (
            <div key={g.id}>
              <Link href={`${TOOLS_HUB.path}#${g.id}`} className="tools-menu-heading" onClick={() => setOpen(false)}>
                <span style={{ color: g.color, background: `color-mix(in srgb, ${g.color} 16%, transparent)` }}><g.Icon size={14} /></span>
                {g.short}
              </Link>
              {g.links.map(t => (
                <Link key={t.path} href={t.path} className="tools-menu-link" onClick={() => setOpen(false)}>{menuName(t.label)}</Link>
              ))}
            </div>
          ))}
        </div>
        <div className="tools-menu-foot">
          <Link href="/guides" onClick={() => setOpen(false)}><BookOpen size={15} /> Guides: MiniRoos rules, fair minutes, rego fees</Link>
          <Link href={TOOLS_HUB.path} className="tools-menu-all" onClick={() => setOpen(false)}>All free tools <ArrowRight size={14} /></Link>
        </div>
      </div>
    </div>
  );
}

/** The Free Tools row in the phone menu, with an arrow that opens the tools by group underneath */
export function ToolsMenuMobile({ onNavigate, rowStyle }: { onNavigate: () => void; rowStyle: CSSProperties }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'stretch', gap: '0.4rem' }}>
        <Link href={TOOLS_HUB.path} onClick={onNavigate} style={{ ...rowStyle, flex: 1 }}>
          <Wrench size={18} color="var(--c-green)" />
          <span>Free Tools</span>
        </Link>
        <button
          type="button"
          aria-expanded={open}
          aria-controls="tools-menu-mobile"
          aria-label={open ? 'Hide the free tools' : 'Show the free tools'}
          onClick={() => setOpen(o => !o)}
          style={{ ...rowStyle, padding: '0 0.85rem', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
        >
          <ChevronDown size={18} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>
      <div id="tools-menu-mobile" hidden={!open} className="tools-menu-mobile">
        {MENU_GROUPS.map(g => (
          <div key={g.id}>
            <div className="tools-menu-mobile-heading"><g.Icon size={13} color={g.color} /> {g.short}</div>
            {g.links.map(t => (
              <Link key={t.path} href={t.path} onClick={onNavigate}>{menuName(t.label)}</Link>
            ))}
          </div>
        ))}
        <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <Link href="/guides" onClick={onNavigate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--club-ink)', fontWeight: 600, fontSize: '0.88rem' }}>
            <BookOpen size={15} /> Guides (MiniRoos rules, minutes, rego fees)
          </Link>
          <Link href={TOOLS_HUB.path} onClick={onNavigate} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            All free tools <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
