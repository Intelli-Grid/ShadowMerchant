import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function GET() {
  const { userId, sessionClaims } = await auth();
  const user = await currentUser();

  return NextResponse.json({
    userId,
    sessionClaims,
    publicMetadata: user?.publicMetadata ?? null,
    roleFromClaims: (sessionClaims?.publicMetadata as any)?.role ?? 'NOT FOUND IN CLAIMS',
    roleFromUser: (user?.publicMetadata as any)?.role ?? 'NOT FOUND IN USER',
  });
}
