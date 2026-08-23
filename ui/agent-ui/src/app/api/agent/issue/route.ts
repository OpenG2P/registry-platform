import { NextRequest } from 'next/server';
import { proxyIssue } from '@/app/api/_lib/agent-proxy';

export async function POST(req: NextRequest) {
    return proxyIssue(req);
}
