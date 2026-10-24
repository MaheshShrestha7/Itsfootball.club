import { redirect } from 'next/navigation';

// Squad & Players is part of the People page now; old links and bookmarks land there
export default async function SquadRedirect({ params }: { params: Promise<{ clubSlug: string }> }) {
  const { clubSlug } = await params;
  redirect(`/${clubSlug}/admin/people`);
}
