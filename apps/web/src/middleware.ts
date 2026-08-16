import { NextResponse } from 'next/server';
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/wishlist(.*)',
  '/alerts(.*)',
]);

const isAdminRoute = createRouteMatcher(['/admin(.*)', '/api/admin(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }

  // Admin routes: must be signed in AND have role=admin.
  if (isAdminRoute(req)) {
    const { userId, sessionClaims } = await auth();
    const isAdmin = (sessionClaims?.publicMetadata as any)?.role === 'admin';
    if (!userId || !isAdmin) {
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/sign-in', req.url));
    }
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
