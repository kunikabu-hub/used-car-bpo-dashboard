import type { Metadata } from "next";
import Dashboard from "./dashboard";

export const metadata: Metadata = {
  title: "中古車BPO 収益・投資シミュレーター",
  description: "アッタデザインとNaSの店舗別収益、初期投資、用具費、店舗展開キャッシュフローを一元管理するダッシュボード。",
};

export default function Home() {
  return <Dashboard />;
}
