import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#FAF9F6",
};

export const metadata: Metadata = {
  title: {
    default: "VaultRAG — Permission-Aware Multi-Tenant RAG Service",
    template: "%s | VaultRAG Enterprise",
  },
  description:
    "Enterprise-grade document Q&A service engineered with PostgreSQL FORCE RLS, hybrid search, and zero cross-tenant data leakage.",
  keywords: [
    "RAG",
    "Multi-Tenant",
    "PostgreSQL",
    "Row Level Security",
    "RLS",
    "pgvector",
    "Enterprise AI",
    "Data Leak Prevention",
    "Audit Ledger",
  ],
  authors: [{ name: "VaultRAG Security Engineering" }],
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "VaultRAG — Permission-Aware Multi-Tenant RAG Service",
    description:
      "Enterprise document Q&A service with database-level tenant isolation, group ACLs, and tamper-evident audit ledger.",
    type: "website",
    locale: "en_US",
    siteName: "VaultRAG Enterprise",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-background text-text-primary antialiased selection:bg-[#0F172A]/10 selection:text-[#0F172A] min-h-screen flex flex-col overflow-x-hidden font-sans">
        {children}
      </body>
    </html>
  );
}
