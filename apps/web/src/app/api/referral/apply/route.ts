import { NextRequest, NextResponse } from 'next/server';

// Called after Clerk redirects back from sign-up with ?ref= param
// This route applies the referral code to the newly signed-up user
export async function GET(req: NextRequest) {
  const ref = req.nextUrl.searchParams.get('ref');
  const redirectTo = req.nextUrl.searchParams.get('redirectTo') || '/dashboard';

  if (ref) {
    // Store the ref code in a cookie so it persists through Clerk's OAuth flow
    const response = NextResponse.redirect(new URL(redirectTo, req.url));
    response.cookies.set('sm_ref', ref.toUpperCase(), { maxAge: 60 * 60 * 24 * 7, path: '/' });
    return response;
  }

  return NextResponse.redirect(new URL(redirectTo, req.url));
}
