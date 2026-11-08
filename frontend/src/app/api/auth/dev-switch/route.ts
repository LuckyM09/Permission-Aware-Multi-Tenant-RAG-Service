import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const DEV_PERSONAS: Record<string, { email: string }> = {
  alice: { email: "alice@acme.com" },
  bob: { email: "bob@acme.com" },
  charlie: { email: "charlie@acme.com" },
  mallory: { email: "mallory@betalabs.com" },
};

export async function POST(request: Request) {
  // Never permit persona switching in production unless explicitly flagged for demo
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ENABLE_DEMO_SWITCHER !== "true" &&
    process.env.NEXT_PUBLIC_ENABLE_DEMO_SWITCHER !== "true"
  ) {
    return NextResponse.json(
      { error: "Dev persona switching is disabled in production." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { personaId } = body;

    const persona = DEV_PERSONAS[personaId];
    if (!persona) {
      return NextResponse.json(
        { error: "Unknown dev persona requested." },
        { status: 400 }
      );
    }

    const password = process.env.DEMO_USER_PASSWORD || "SecurePassword123!";

    const res = await fetch(`${DJANGO_API_URL}/api/auth/token/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: persona.email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || "Authentication failed for dev persona." },
        { status: res.status }
      );
    }

    const { access, refresh, user, tenant, groups } = data;
    const cookieStore = cookies();

    // Store tokens in secure HttpOnly cookies (BFF Pattern)
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

