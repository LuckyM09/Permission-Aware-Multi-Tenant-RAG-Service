import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VaultRAG — Permission-Aware Multi-Tenant RAG Service",
  description:
    "Enterprise-grade document Q&A service engineered with Access Control by Design and zero data leakage.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-background text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
