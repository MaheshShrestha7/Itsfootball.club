'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Clock, Plus, X } from 'lucide-react';
import { teamLabel } from '@/lib/teams';
import {
  addDays, CALENDAR_KINDS, dayKey, filterItems, itemsOnDay, layoutDay, monthGrid, sameDay,
  startOfDay, weekDays, type CalendarItem, type CalendarKind,
} from '@/lib/admin-calendar';
import { DATE_LOCALE } from '@/lib/dates';
import type { ClubTeam } from '@/lib/supabase/types';

type View = 'month' | 'week' | 'list';

export type CalendarLink = { href: string; text: string; primary?: boolean };

const HOUR_PX = 44;
const MONTH_CELL_ITEMS = 3;
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const KIND_COLOR = Object.fromEntries(CALENDAR_KINDS.map(k => [k.key, k.color])) as Record<CalendarKind, string>;
const KIND_LABEL: Record<CalendarKind, string> = {
  match: 'Match', training: 'Training', social: 'Social / AGM', trial: 'Trial', tournament: 'Tournament', season: 'Season',
};

const fmtTime = (d: Date) => d.toLocaleTimeString(DATE_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDay = (d: Date) => d.toLocaleDateString(DATE_LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });
const fmtMonth = (d: Date) => d.toLocaleDateString(DATE_LOCALE, { month: 'long', year: 'numeric' });

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function store(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or storage blocked: the choice just isn't remembered
  }
}

/**
 * Month, week and list views of a club's dated items, used by the admin calendar and the public one.
 * The page decides which items this viewer may see and where each one links to.
 */
export default function ClubCalendar({ items: allItems, kindChips, teams, storageKey, itemLinks, addLinks, head }: {
  /** Everything this viewer may see; the team and kind filters are applied here */
  items: CalendarItem[];
  kindChips: typeof CALENDAR_KINDS;
  teams: ClubTeam[];
  /** Prefix for the remembered view and filters */
  storageKey: string;
  itemLinks: (item: CalendarItem) => CalendarLink[];
  /** Offers to add something on a day or time slot; leave out for viewers who can't add */
  addLinks?: (day: Date, time: string | undefined, team: string | undefined) => CalendarLink[];
  /** Above the toolbar; given the handler for an "Add" button when adding is on */
  head?: (onAdd?: (e: React.MouseEvent<HTMLElement>) => void) => React.ReactNode;
}) {
  const VIEW_KEY = `${storageKey}_view`;
  const KINDS_KEY = `${storageKey}_kinds`;
  const multiTeam = teams.length > 1;
  const teamsById = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);

  const [view, setView] = useState<View>('month');
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [teamFilter, setTeamFilter] = useState('ALL');
  const [kinds, setKinds] = useState<Set<CalendarKind>>(() => new Set(CALENDAR_KINDS.map(k => k.key)));
  const [open, setOpen] = useState<{ item: CalendarItem; rect: DOMRect } | null>(null);
  const [adding, setAdding] = useState<{ day: Date; time?: string; rect: DOMRect } | null>(null);
  const today = startOfDay(new Date());

  // Remembered view and filters; phones start on the list, where a month grid is too cramped
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 640px)').matches;
    setView(readStored<View>(VIEW_KEY, phone ? 'list' : 'month'));
    const saved = readStored<CalendarKind[] | null>(KINDS_KEY, null);
    if (Array.isArray(saved)) setKinds(new Set(saved.filter(k => k in KIND_COLOR)));
  }, [VIEW_KEY, KINDS_KEY]);

  const pickView = (v: View) => {
    setView(v);
    store(VIEW_KEY, v);
  };
  const toggleKind = (k: CalendarKind) => {
    setKinds(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      store(KINDS_KEY, [...next]);
      return next;
    });
  };

  const items = useMemo(
    () => filterItems(allItems, kinds, multiTeam ? teamFilter : 'ALL'),
    [allItems, kinds, multiTeam, teamFilter]
  );

  const label = (i: CalendarItem) => {
    // Which team, when it isn't obvious: several teams, all shown, and not the main team
    const team = i.teamId ? teamsById.get(i.teamId) : undefined;
    if (!multiTeam || teamFilter !== 'ALL' || !team || team.is_default) return i.title;
    const name = teamLabel(team);
    return i.title.toLowerCase().includes(name.toLowerCase()) ? i.title : `${name} ${i.title}`;
  };

  const step = (dir: 1 | -1) => {
    closeAll();
    setAnchor(a => (view === 'week' ? addDays(a, 7 * dir) : new Date(a.getFullYear(), a.getMonth() + dir, 1)));
  };
  const goToday = () => {
    closeAll();
    setAnchor(startOfDay(new Date()));
  };
  const openDay = (day: Date) => {
    closeAll();
    setAnchor(day);
    pickView('week');
  };
  const show = (item: CalendarItem, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setAdding(null);
    setOpen({ item, rect: e.currentTarget.getBoundingClientRect() });
  };

  const addAt = (day: Date, time: string | undefined, e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    setOpen(null);
    const rect = e.currentTarget.getBoundingClientRect();
    // A time slot is a whole column: anchor the popover where it was clicked
    setAdding({ day, time, rect: time ? new DOMRect(e.clientX, e.clientY, 0, 0) : rect });
  };
  const closeAll = () => {
    setOpen(null);
    setAdding(null);
  };

  const week = weekDays(anchor);
  const heading = view === 'week'
    ? `${week[0].toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short' })} to ${week[6].toLocaleDateString(DATE_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : fmtMonth(anchor);

  return (
    <div className="admin-cal" onClick={closeAll}>
      {head?.(addLinks ? e => addAt(view === 'week' || anchor.getMonth() !== today.getMonth() ? anchor : today, undefined, e) : undefined)}

      <div className="admin-cal-bar">
        <div className="admin-cal-nav">
          <button data-view-ok type="button" className="btn btn-secondary btn-sm" aria-label={view === 'week' ? 'Previous week' : 'Previous month'} onClick={() => step(-1)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button data-view-ok type="button" className="btn btn-secondary btn-sm" aria-label={view === 'week' ? 'Next week' : 'Next month'} onClick={() => step(1)}>
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <button data-view-ok type="button" className="btn btn-secondary btn-sm" onClick={goToday}>Today</button>
          <h2 className="admin-cal-title">{heading}</h2>
        </div>
        <div className="admin-cal-nav">
          {multiTeam && (
            <select data-view-ok aria-label="Team" className="form-input" value={teamFilter} onChange={e => setTeamFilter(e.target.value)} style={{ width: 'auto', padding: '0.45rem 0.75rem', fontSize: '0.82rem' }}>
              <option value="ALL">All teams</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <div data-view-ok role="tablist" aria-label="Calendar view" className="admin-cal-seg">
            {(['month', 'week', 'list'] as View[]).map(v => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => pickView(v)}>
                {v[0].toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-cal-chips" data-view-ok>
        {kindChips.map(k => (
          <button key={k.key} type="button" aria-pressed={kinds.has(k.key)} onClick={() => toggleKind(k.key)} style={{ '--k': k.color } as React.CSSProperties}>
            <i />{k.label}
          </button>
        ))}
      </div>

      {view === 'month' && (
        <MonthView anchor={anchor} today={today} items={items} label={label} onItem={show} onDay={openDay} onAdd={addLinks ? addAt : undefined} />
      )}
      {view === 'week' && <WeekView days={week} today={today} items={items} label={label} onItem={show} onAdd={addLinks ? addAt : undefined} />}
      {view === 'list' && <ListView anchor={anchor} today={today} items={items} label={label} onItem={show} />}

      {adding && addLinks && (
        <AddPopover
          day={adding.day}
          time={adding.time}
          rect={adding.rect}
          links={addLinks(adding.day, adding.time, multiTeam ? teamFilter : undefined)}
          onClose={() => setAdding(null)}
        />
      )}
      {open && (
        <ItemPopover
          item={open.item}
          rect={open.rect}
          title={label(open.item)}
          teamName={open.item.teamId ? teamsById.get(open.item.teamId)?.name : undefined}
          links={itemLinks(open.item)}
          onClose={() => setOpen(null)}
        />
      )}
    </div>
  );
}

type ItemHandler = (item: CalendarItem, e: React.MouseEvent<HTMLElement>) => void;

function Chip({ item, text, onItem, time = true, continues }: { item: CalendarItem; text: string; onItem: ItemHandler; time?: boolean; continues?: { before: boolean; after: boolean } }) {
  const past = item.end.getTime() <= Date.now();
  const cls = ['admin-cal-chip', past && 'is-past', item.off && 'is-off', item.allDay && 'is-allday', continues?.before && 'cont-before', continues?.after && 'cont-after']
    .filter(Boolean).join(' ');
  return (
    <button data-view-ok type="button" className={cls} style={{ '--k': KIND_COLOR[item.kind] } as React.CSSProperties} onClick={e => onItem(item, e)} title={text}>
      {time && !item.allDay && <b>{fmtTime(item.start)}</b>}
      <span className="admin-cal-chip-text">{text}</span>
      {item.score && <span className={`admin-cal-res res-${item.result || 'N'}`}>{item.result ? `${item.result} ` : ''}{item.score}</span>}
    </button>
  );
}

type AddHandler = (day: Date, time: string | undefined, e: React.MouseEvent<HTMLElement>) => void;

function MonthView({ anchor, today, items, label, onItem, onDay, onAdd }: {
  anchor: Date; today: Date; items: CalendarItem[]; label: (i: CalendarItem) => string; onItem: ItemHandler; onDay: (d: Date) => void; onAdd?: AddHandler;
}) {
  const days = monthGrid(anchor);
  return (
    <div className="admin-cal-month">
      {DOW.map(d => <div key={d} className="admin-cal-dow">{d}</div>)}
      {days.map(day => {
        const dayItems = itemsOnDay(items, day);
        const extra = dayItems.length - MONTH_CELL_ITEMS;
        const out = day.getMonth() !== anchor.getMonth();
        const isToday = sameDay(day, today);
        const cls = ['admin-cal-day', out && 'is-out', day < today && 'is-past', isToday && 'is-today', onAdd && 'is-addable'].filter(Boolean).join(' ');
        return (
          // Clicking the empty part of a day offers to add something on it
          <div key={dayKey(day)} className={cls} onClick={onAdd ? e => onAdd(day, undefined, e) : undefined}>
            <button data-view-ok type="button" className="admin-cal-daynum" aria-label={`Open the week of ${fmtDay(day)}`} onClick={e => { e.stopPropagation(); onDay(day); }}>
              {day.getDate()}
            </button>
            {dayItems.slice(0, extra > 0 ? MONTH_CELL_ITEMS - 1 : MONTH_CELL_ITEMS).map(i => {
              const multi = i.allDay && i.end.getTime() - i.start.getTime() > 24 * 3600 * 1000 + 3600 * 1000;
              const before = multi && i.start < day && day.getDay() !== 1;
              const after = multi && addDays(day, 1) < i.end && day.getDay() !== 0;
              // A bar running across days names itself once per row
              const text = multi && i.start < day && day.getDay() !== 1 ? ' ' : label(i);
              return <Chip key={i.key} item={i} text={text} onItem={onItem} continues={multi ? { before, after } : undefined} />;
            })}
            {extra > 0 && (
              <button data-view-ok type="button" className="admin-cal-more" onClick={e => { e.stopPropagation(); onDay(day); }}>+{extra + 1} more</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function WeekView({ days, today, items, label, onItem, onAdd }: {
  days: Date[]; today: Date; items: CalendarItem[]; label: (i: CalendarItem) => string; onItem: ItemHandler; onAdd?: AddHandler;
}) {
  const perDay = days.map(d => itemsOnDay(items, d));
  // 08:00 to 22:00, stretched to fit anything earlier or later that week
  let first = 8;
  let last = 22;
  perDay.forEach((list, idx) => list.forEach(i => {
    if (i.allDay) return;
    const dayStart = days[idx].getTime();
    const s = Math.max(0, (i.start.getTime() - dayStart) / 3600000);
    const e = Math.min(24, (i.end.getTime() - dayStart) / 3600000);
    first = Math.min(first, Math.floor(s));
    last = Math.max(last, Math.ceil(e));
  }));
  const hours = Array.from({ length: last - first }, (_, i) => first + i);
  const now = new Date();

  return (
    <div className="admin-cal-week-wrap">
      <div className="admin-cal-week">
        <div />
        {days.map(d => (
          <div key={dayKey(d)} className={`admin-cal-wh${sameDay(d, today) ? ' is-today' : ''}`}>
            <small>{DOW[(d.getDay() + 6) % 7]}</small>
            <span>{d.getDate()}</span>
          </div>
        ))}
        <div className="admin-cal-allday-label">all day</div>
        {perDay.map((list, idx) => (
          <div key={idx} className="admin-cal-allday">
            {list.filter(i => i.allDay).map(i => <Chip key={i.key} item={i} text={label(i)} onItem={onItem} />)}
          </div>
        ))}
        <div className="admin-cal-hours">
          {hours.map(h => <div key={h} style={{ height: HOUR_PX }}>{String(h).padStart(2, '0')}:00</div>)}
        </div>
        {perDay.map((list, idx) => {
          const day = days[idx];
          const top = (d: Date) => Math.max(0, ((d.getTime() - day.getTime()) / 3600000 - first) * HOUR_PX);
          const timed = list.filter(i => !i.allDay);
          return (
            <div
              key={idx}
              className={`admin-cal-col${sameDay(day, today) ? ' is-today' : ''}${onAdd ? ' is-addable' : ''}`}
              style={{ height: hours.length * HOUR_PX }}
              // Clicking an empty slot offers to add something at that hour
              onClick={onAdd ? e => {
                const hour = Math.min(23, first + Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_PX));
                onAdd(day, `${String(hour).padStart(2, '0')}:00`, e);
              } : undefined}
            >
              {layoutDay(timed).map(({ item, lane, lanes }) => {
                const y = top(item.start < day ? day : item.start);
                const end = Math.min(item.end.getTime(), addDays(day, 1).getTime());
                const h = Math.max(22, top(new Date(end)) - y - 2);
                const past = item.end.getTime() <= Date.now();
                return (
                  <button
                    data-view-ok
                    key={item.key}
                    type="button"
                    className={`admin-cal-block${past ? ' is-past' : ''}${item.off ? ' is-off' : ''}`}
                    style={{ '--k': KIND_COLOR[item.kind], top: y, height: h, left: `calc(${(100 / lanes) * lane}% + 3px)`, width: `calc(${100 / lanes}% - 6px)` } as React.CSSProperties}
                    onClick={e => onItem(item, e)}
                    title={label(item)}
                  >
                    <strong>{label(item)}</strong>
                    <small>{fmtTime(item.start)}{item.place ? `, ${item.place}` : ''}{item.score ? `, ${item.result ? `${item.result} ` : ''}${item.score}` : ''}</small>
                  </button>
                );
              })}
              {sameDay(day, today) && now.getHours() >= first && now.getHours() < last && (
                <div className="admin-cal-now" style={{ top: top(now) }} aria-hidden />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ anchor, today, items, label, onItem }: {
  anchor: Date; today: Date; items: CalendarItem[]; label: (i: CalendarItem) => string; onItem: ItemHandler;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const count = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: count }, (_, i) => addDays(first, i))
    .map(day => ({ day, list: itemsOnDay(items, day) }))
    .filter(d => d.list.length);
  const todayRef = useRef<HTMLDivElement>(null);
  // Open on today (or the next busy day) when this month is shown
  useEffect(() => {
    todayRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [anchor]);
  const focusKey = days.find(d => d.day >= today)?.day;

  if (!days.length) {
    return (
      <div className="admin-panel admin-empty admin-cal-empty">
        <CalendarDays size={32} aria-hidden="true" color="var(--text-muted)" />
        <p style={{ margin: 0 }}>Nothing on the calendar this month.</p>
      </div>
    );
  }
  return (
    <div className="admin-cal-list">
      {days.map(({ day, list }) => (
        <div key={dayKey(day)} ref={focusKey && sameDay(day, focusKey) ? todayRef : undefined} className="admin-cal-listday">
          <h3 className={sameDay(day, today) ? 'is-today' : undefined}>{sameDay(day, today) ? `Today, ${fmtDay(day)}` : fmtDay(day)}</h3>
          {list.map(i => (
            <button
              data-view-ok
              key={i.key}
              type="button"
              className={`admin-cal-card${i.end.getTime() <= Date.now() ? ' is-past' : ''}${i.off ? ' is-off' : ''}`}
              style={{ '--k': KIND_COLOR[i.kind] } as React.CSSProperties}
              onClick={e => onItem(i, e)}
            >
              <span className="admin-cal-card-time">{i.allDay ? 'All day' : fmtTime(i.start)}</span>
              <span className="admin-cal-card-body">
                <strong>{label(i)}</strong>
                {i.place && <small>{i.place}</small>}
              </span>
              {i.score && <span className={`admin-cal-res res-${i.result || 'N'}`}>{i.result ? `${i.result} ` : ''}{i.score}</span>}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function ItemPopover({ item, rect, title, teamName, links, onClose }: {
  item: CalendarItem; rect: DOMRect; title: string; teamName?: string; links: CalendarLink[]; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Beside the item, kept on screen; phones get a sheet along the bottom (CSS)
  const width = 300;
  const left = Math.min(Math.max(12, rect.right + 8 + width > window.innerWidth ? rect.left - width - 8 : rect.right + 8), window.innerWidth - width - 12);
  const top = Math.min(Math.max(12, rect.top - 8), window.innerHeight - 260);

  const lastDay = addDays(item.end, -1);
  const when = item.allDay
    ? sameDay(item.start, lastDay) || lastDay < item.start ? fmtDay(item.start) : `${fmtDay(item.start)} to ${fmtDay(lastDay)}`
    : `${fmtDay(item.start)}, ${fmtTime(item.start)}${sameDay(item.start, item.end) ? ` to ${fmtTime(item.end)}` : ''}`;
  const status = item.status ? item.status[0].toUpperCase() + item.status.slice(1).replace(/_/g, ' ') : undefined;

  return (
    <div
      className="admin-cal-pop"
      role="dialog"
      aria-label={title}
      style={{ '--k': KIND_COLOR[item.kind], left, top, width } as React.CSSProperties}
      onClick={e => e.stopPropagation()}
    >
      <button data-view-ok type="button" className="admin-cal-pop-x" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      <span className="admin-cal-pop-tag">{KIND_LABEL[item.kind]}{teamName ? `, ${teamName}` : ''}</span>
      <h3>{title}</h3>
      <p><Clock size={14} aria-hidden="true" />{when}</p>
      {item.place && <p><MapPin size={14} aria-hidden="true" />{item.place}</p>}
      {(status || item.score) && (
        <p className="admin-cal-pop-status">
          {status}
          {item.score && <span className={`admin-cal-res res-${item.result || 'N'}`}>{item.result ? `${item.result} ` : ''}{item.score}</span>}
        </p>
      )}
      {links.length > 0 && (
        <div className="admin-cal-pop-links">
          {links.map(l => (
            <Link key={l.href} href={l.href} className={`btn btn-sm ${l.primary ? 'btn-primary' : 'btn-secondary'}`}>{l.text}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AddPopover({ day, time, rect, links, onClose }: {
  day: Date; time?: string; rect: DOMRect; links: CalendarLink[]; onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const width = 240;
  const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
  const top = Math.min(Math.max(12, rect.top + Math.min(rect.height, 40)), window.innerHeight - 180);
  const title = `${fmtDay(day)}${time ? `, ${time}` : ''}`;

  return (
    <div className="admin-cal-pop" role="dialog" aria-label={`Add on ${title}`} style={{ left, top, width }} onClick={e => e.stopPropagation()}>
      <button data-view-ok type="button" className="admin-cal-pop-x" aria-label="Close" onClick={onClose}><X size={16} aria-hidden="true" /></button>
      <h3>Add on {title}</h3>
      <div className="admin-cal-pop-links admin-cal-pop-stack">
        {links.map(l => (
          <Link key={l.href} href={l.href} className="btn btn-sm btn-secondary"><Plus size={14} /> {l.text}</Link>
        ))}
      </div>
    </div>
  );
}
