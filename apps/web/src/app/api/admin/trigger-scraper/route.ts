import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const { sessionClaims } = await auth();
  if ((sessionClaims?.publicMetadata as any)?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let platform: string;
  let mode: string;
  try {
    const body = await req.json();
    platform = body.platform;
    mode = body.mode || 'standard';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validPlatforms = ['amazon', 'flipkart', 'meesho', 'myntra', 'nykaa', 'croma', 'tatacliq', 'all'];
  if (!validPlatforms.includes(platform)) {
    return NextResponse.json({ error: `Invalid platform. Valid: ${validPlatforms.join(', ')}` }, { status: 400 });
  }

  const githubPAT   = process.env.GITHUB_PAT;
  const repoOwner   = process.env.GITHUB_REPO_OWNER;
  const repoName    = process.env.GITHUB_REPO_NAME;

  if (!githubPAT || !repoOwner || !repoName) {
    return NextResponse.json(
      { error: 'GitHub PAT not configured. Add GITHUB_PAT, GITHUB_REPO_OWNER, GITHUB_REPO_NAME to env.' },
      { status: 503 }
    );
  }

  try {
    const ghRes = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/actions/workflows/scrape.yml/dispatches`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubPAT}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { platform, mode },
        }),
      }
    );

    // GitHub returns 204 No Content on success
    if (!ghRes.ok && ghRes.status !== 204) {
      const errText = await ghRes.text();
      return NextResponse.json({ error: `GitHub API error (${ghRes.status}): ${errText}` }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      message: `${platform} scraper triggered via GitHub Actions (mode: ${mode})`,
      note: 'Run will appear in GitHub Actions tab within ~30 seconds.',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
