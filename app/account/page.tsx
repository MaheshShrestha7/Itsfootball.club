'use client';

import { useState } from 'react';
import PlatformNavbar from '@/components/PlatformNavbar';
import Footer from '@/components/Footer';
import AuthModal from '@/components/AuthModal';
import AccountSettings from '@/components/account/AccountSettings';

export default function AccountPage() {
  const [authOpen, setAuthOpen] = useState(false);
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-pitch)' }}>
      <PlatformNavbar />
      <main style={{ flex: 1 }}>
        <AccountSettings onSignIn={() => setAuthOpen(true)} />
      </main>
      <Footer />
      <AuthModal isOpen={authOpen} onClose={() => setAuthOpen(false)} redirectTo="/account" />
    </div>
  );
}
