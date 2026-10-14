import JsonLd from '@/components/JsonLd';
import { clubShopSchema } from '@/lib/schema';
import { findClubBySlug, listClubShop } from '@/lib/supabase/club-lookup';

export default async function ClubShopSchema({ params }: { params: Promise<{ clubSlug: string }> }) {
  const club = await findClubBySlug((await params).clubSlug);
  if (!club) return null;
  const { products, currency } = await listClubShop(club.id);
  return <JsonLd data={clubShopSchema(club, products, currency)} />;
}
