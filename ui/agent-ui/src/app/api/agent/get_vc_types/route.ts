import { NextRequest } from 'next/server';
import { AGENT_API, proxyToAgentApi } from '@/app/api/_lib/agent-proxy';

export async function POST(req: NextRequest) {
    return proxyToAgentApi(req, AGENT_API.getVcTypes);
}
