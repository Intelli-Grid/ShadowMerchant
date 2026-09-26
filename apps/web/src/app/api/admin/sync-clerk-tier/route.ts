import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectDB } from '@/lib/db';
import User from '@/models/User';

/**
 * POST /api/admin/sync-clerk-tier
 *
 * Reconciliation endpoint: repairs the case where MongoDB tier = pro but
 * Clerk publicMetadata tier is stale (e.g. Clerk API was unavailable during
 * webhook delivery and the Clerk update was safely skipped).
 *
 * For each user whose MongoDB subscription_tier=pro, ensures Clerk publicMetadata
 * also has { tier: 'pro' } — without overwriting any other metadata fields.
 *
 * Admin-only. Idempotent. Does not alter MongoDB records.
 *
 * Query params:
 *   ?clerk_id=<id>   — reconcile a single user (optional; omit to reconcile all pro users)
 *   ?apply=true      — REQUIRED to perform live writes; default is dry-run
 *
 * Safety: default behaviour is DRY RUN. Pass ?apply=true to commit changes.
 */
export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const targetClerkId = searchParams.get('clerk_id');
  // Dry-run is the DEFAULT — caller must explicitly pass ?apply=true to write.
  const dryRun = searchParams.get('apply') !== 'true';

  await connectDB();
  const { clerkClient } = await import('@clerk/nextjs/server');
  const clerk = await clerkClient();

  // Find users where MongoDB says pro but we need to verify Clerk
  const query: Record<string, unknown> = { subscription_tier: 'pro' };
  if (targetClerkId) {
    query.clerk_id = targetClerkId;
  }

  const proUsers = await User.find(query, { clerk_id: 1, email: 1, subscription_tier: 1 })
    .lean()
    .limit(200); // Safety cap — run in batches if >200 pro users

  const results: Array<{ clerk_id: string; email: string; result: string }> = [];

  for (const user of proUsers) {
    const u = user as any;
    if (!u.clerk_id) {
      results.push({ clerk_id: 'missing', email: u.email ?? 'unknown', result: 'SKIP: no clerk_id' });
      continue;
    }

    try {
      const clerkUser = await clerk.users.getUser(u.clerk_id);
      const existingMeta = (clerkUser.publicMetadata as Record<string, unknown>) ?? {};

      if (existingMeta.tier === 'pro') {
        results.push({ clerk_id: u.clerk_id, email: u.email, result: 'ALREADY_SYNCED' });
        continue;
      }

      if (dryRun) {
        results.push({ clerk_id: u.clerk_id, email: u.email, result: `DRY_RUN: would set tier=pro (current: ${existingMeta.tier ?? 'missing'})` });
        continue;
      }

      // Preserve ALL existing metadata, only update tier
      await clerk.users.updateUserMetadata(u.clerk_id, {
        publicMetadata: { ...existingMeta, tier: 'pro' },
      });

      results.push({ clerk_id: u.clerk_id, email: u.email, result: 'SYNCED: tier=pro' });
    } catch (err: any) {
      results.push({ clerk_id: u.clerk_id, email: u.email, result: `ERROR: ${err?.message ?? String(err)}` });
    }
  }

  const synced   = results.filter(r => r.result.startsWith('SYNCED')).length;
  const skipped  = results.filter(r => r.result === 'ALREADY_SYNCED').length;
  const errors   = results.filter(r => r.result.startsWith('ERROR')).length;
  const dryRuns  = results.filter(r => r.result.startsWith('DRY_RUN')).length;

  return NextResponse.json({
    dry_run: dryRun,
    total_checked: proUsers.length,
    synced,
    already_synced: skipped,
    errors,
    dry_run_would_sync: dryRuns,
    results,
  });
}
