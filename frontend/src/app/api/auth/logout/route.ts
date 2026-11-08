import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function POST() {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get("vaultrag_refresh")?.value;

  // Invalidate refresh token on Django backend SimpleJWT blacklist table
  if (refreshToken) {
    try {
      await fetch(`${DJANGO_API_URL}/api/auth/logout/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });
    } catch (err) {
      // Backend may be offline or unreachable during client teardown; log but continue clearing browser session
      console.error("[Logout] Failed to blacklist refresh token on backend:", err);
    }
  }

  // Clear via Next.js cookies API
  try {
    cookieStore.delete("vaultrag_access");
    cookieStore.delete("vaultrag_refresh");
  } catch {
    // Ignore any delete errors
  }

  const response = NextResponse.json(
    { success: true, message: "Logged out successfully." },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );

  // Explicitly overwrite cookies with expired date and path=/ on the response
  response.cookies.set("vaultrag_access", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  response.cookies.set("vaultrag_refresh", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function GET() {
  return POST();
}
