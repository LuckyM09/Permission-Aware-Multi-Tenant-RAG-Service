import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const res = await fetch(`${DJANGO_API_URL}/api/v1/tenants/register/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Registration failed." },
        { status: res.status }
      );
    }

    // Approval mode: the backend queued the request and issued no session.
    if (data.pending) {
      return NextResponse.json({
        success: true,
        pending: true,
        message: data.detail,
      });
    }

    const { access, refresh, user, tenant, groups } = data;
    const cookieStore = cookies();

    if (access && refresh) {
      cookieStore.set("vaultrag_access", access, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60, // 1 hour
      });

      cookieStore.set("vaultrag_refresh", refresh, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });
    }

    return NextResponse.json({
      success: true,
      user,
      tenant,
      groups,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

