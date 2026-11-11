import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const DJANGO_API_URL =
  process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// Simple in-memory rate limiter per IP address (5 submissions per 10 minutes)
const ipRateLimit = new Map<string, number[]>();

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown-ip";
    const now = Date.now();
    const timestamps = (ipRateLimit.get(ip) || []).filter((t) => now - t < 600000);

    if (timestamps.length >= 5) {
      return NextResponse.json(
        { error: "Too many contact submissions. Please wait a few minutes before trying again." },
        { status: 429 }
      );
    }
    timestamps.push(now);
    ipRateLimit.set(ip, timestamps);

    const body = await req.json();
    const { name, email, company, inquiry, message, work_phone_ext } = body;

    // Honeypot anti-spam check: bots fill hidden fields, humans do not
    if (work_phone_ext) {
      // Silently accept without saving
      return NextResponse.json(
        { success: true, message: "Your inquiry has been received." },
        { status: 200 }
      );
    }

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Name, email, and message are required fields." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address." },
        { status: 400 }
      );
    }

    // 1. Primary storage: Persist inquiry into PostgreSQL via Django API
    try {
      const backendRes = await fetch(`${DJANGO_API_URL}/api/v1/tenants/inquiry/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": ip,
        },
        body: JSON.stringify({
          full_name: String(name).trim(),
          work_email: String(email).trim().toLowerCase(),
          company_name: company ? String(company).trim() : "N/A",
          inquiry_type: inquiry || "General Architecture",
          use_case: String(message).trim(),
        }),
      });

      if (!backendRes.ok) {
        if (backendRes.status === 429) {
          return NextResponse.json(
            { error: "Too many contact submissions. Please wait a few minutes before trying again." },
            { status: 429 }
          );
        }
        console.error("[ContactForm] Backend DB returned non-OK status:", backendRes.status);
        return NextResponse.json(
          { error: "Unable to record inquiry at this time. Please try again later." },
          { status: 502 }
        );
      }
    } catch (backendErr) {
      console.error("[ContactForm] Failed to connect to backend DB:", backendErr);
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again shortly." },
        { status: 503 }
      );
    }

    // 2. Secondary backup: File storage if volume is available
    try {
      const dataDir = path.join(process.cwd(), "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      const filePath = path.join(dataDir, "inquiries.jsonl");
      const record = {
        timestamp: new Date().toISOString(),
        name: String(name).trim(),
        email: String(email).trim().toLowerCase(),
        company: company ? String(company).trim() : "N/A",
        inquiryType: inquiry || "",
        message: String(message).trim(),
        clientIp: ip,
      };
      await fs.promises.appendFile(filePath, JSON.stringify(record) + "\n", "utf-8");
    } catch {
      // Ignore filesystem permission issues in container environments
    }

    return NextResponse.json(
      {
        success: true,
        message: "Your inquiry has been recorded. Our team will review your requirements and follow up via email.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[ContactForm] Error processing submission:", err);
    return NextResponse.json(
      { error: "Internal server error processing contact submission." },
      { status: 500 }
    );
  }
}

