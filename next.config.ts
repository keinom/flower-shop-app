import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 将来的な画像ホスティング拡張に備えてドメインを設定しやすくする
  images: {
    remotePatterns: [],
  },
  // Supabase型定義とNext.js 16の互換性問題を回避
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
