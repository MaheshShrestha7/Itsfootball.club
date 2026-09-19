'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useClub } from '@/lib/club-context';

export default function AdminRootRedirect() {
  const router = useRouter();
  const { clubs, activeClub, isHydrated } = useClub();

  useEffect(() => {
    if (!isHydrated) return;
    const targetSlug = activeClub?.slug || clubs[0]?.slug || 'apex-city-fc';
    router.replace(`/${targetSlug}/admin`);
  }, [router, isHydrated, activeClub?.slug, clubs]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
      Redirecting to Management Control Room...
    </div>
  );
}
