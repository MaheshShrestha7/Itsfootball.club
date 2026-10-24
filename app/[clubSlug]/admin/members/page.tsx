import { redirect } from 'next/navigation';

// Old Members tabs -> People page tabs
const TABS: Record<string, string> = { pending: 'applications', active: 'passes', rejected: 'rejected' };

// Members is part of the People page now; old links and bookmarks (and ?member=) land on the same tab there
export default async function MembersRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ clubSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { clubSlug } = await params;
  const query = await searchParams;
  const tab = typeof query.tab === 'string' ? query.tab : 'pending';
  // Member messages moved to the Inbox
  if (tab === 'messages') redirect(`/${clubSlug}/admin/inquiries`);
  const next = new URLSearchParams({ tab: TABS[tab] || 'applications' });
  if (typeof query.member === 'string') next.set('member', query.member);
  redirect(`/${clubSlug}/admin/people?${next}`);
}
