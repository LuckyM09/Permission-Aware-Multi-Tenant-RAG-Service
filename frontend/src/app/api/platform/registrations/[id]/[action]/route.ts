import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteParams {
  params: { id: string; action: string };
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const token = cookies().get("vaultrag_access")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Whitelist both path segments so nothing arbitrary is forwarded to Django.
    if (!UUID_RE.test(params.id) || !["approve", "reject"].includes(params.action)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const res = await fetch(
      `${DJANGO_API_URL}/api/v1/tenants/platform/registrations/${params.id}/${params.action}/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ note: typeof body.note === "string" ? body.note : "" }),
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
