import Link from 'next/link';

/** The Committee page's two tabs: who's on it, and their meetings */
export default function CommitteeTabs({ slug, current }: { slug: string; current: 'committee' | 'meetings' }) {
  const tabs = [
    { id: 'committee', label: 'The committee', href: `/${slug}/admin/committee` },
    { id: 'meetings', label: 'Meetings', href: `/${slug}/admin/committee/meetings` },
  ] as const;
  return (
    <nav className="admin-tabs" aria-label="Committee">
      {tabs.map(t => (
        <Link key={t.id} href={t.href} className="admin-tab" aria-current={t.id === current ? 'page' : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
