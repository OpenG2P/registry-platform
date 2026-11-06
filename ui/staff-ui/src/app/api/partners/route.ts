import { NextRequest } from "next/server";
import { proxyToBackend } from "@/app/api/_lib/backend-proxy";

export async function GET(req: NextRequest) {
	return proxyToBackend({
		req,
		backend: "partneradmin",
		targetEndpoint: "/partners",
	});
}
