import { currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { AdminNavbar } from '@/components/admin/AdminNavbar';

export const metadata = {
  title: 'Mission Control — ShadowMerchant Admin',
  robots: 'noindex, nofollow',
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Use currentUser() — unlike auth()/sessionClaims, this fetches live
  // data from Clerk's API so publicMetadata is always up-to-date,
  // regardless of whether it's in the JWT token or not.
  const user = await currentUser();

  if ((user?.publicMetadata as any)?.role !== 'admin') {
    redirect('/');
  }

  return (
    <div className="min-h-screen" style={{ background: '#080808' }}>
      {/* Subtle top atmospheric glow */}
      <div
        style={{
          position: 'fixed',
          top: -200,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 800,
          height: 500,
          background:
            'radial-gradient(ellipse at center, rgba(201,168,76,0.04) 0%, transparent 70%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <AdminNavbar />
      <main className="relative z-10 max-w-screen-2xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}

