import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("vaultrag_access")?.value;

    if (!token) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: 401, headers: NO_CACHE_HEADERS }
      );
    }

    const res = await fetch(`${DJANGO_API_URL}/api/auth/me/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { authenticated: false, user: null },
        { status: res.status, headers: NO_CACHE_HEADERS }
      );
    }

    const data = await res.json();
    return NextResponse.json(
      { authenticated: true, ...data },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}
