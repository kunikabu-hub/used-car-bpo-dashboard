import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const imageUrl = `${protocol}://${host}/og.png`;
  return {
    title: "中古車BPO 収益・投資シミュレーター",
    description: "アッタデザインとNaSの事業収益・初期投資・店舗展開を可視化する管理ダッシュボード",
    openGraph: { title: "中古車BPO 収益・投資シミュレーター", description: "売上・直接粗利・初期投資・用具費を一元管理", images: [{ url: imageUrl, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: "中古車BPO 収益・投資シミュレーター", description: "売上・直接粗利・初期投資・用具費を一元管理", images: [imageUrl] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ja"><body className={geist.variable}>{children}</body></html>;
}
