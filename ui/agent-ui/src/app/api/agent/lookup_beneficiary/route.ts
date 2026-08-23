import { NextRequest } from 'next/server';
import { proxyToAgentApi } from '@/app/api/_lib/agent-proxy';

export async function POST(req: NextRequest) {
    return proxyToAgentApi(req, 'lookup_beneficiary');
}
