import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const ALLOWED_STATUS = ["pending", "approved", "rejected", "all"];

export async function GET(req: NextRequest) {
  try {
    const token = cookies().get("vaultrag_access")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const status = req.nextUrl.searchParams.get("status") || "pending";
    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ error: "Invalid status filter." }, { status: 400 });
    }

    const res = await fetch(
      `${DJANGO_API_URL}/api/v1/tenants/platform/registrations/?status=${status}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      }
    );

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
