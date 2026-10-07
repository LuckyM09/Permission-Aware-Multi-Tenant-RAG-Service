import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  const cookieStore = cookies();
  cookieStore.delete("vaultrag_access");
  cookieStore.delete("vaultrag_refresh");

  return NextResponse.json({ success: true, message: "Logged out successfully." });
}
