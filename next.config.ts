import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 将来的な画像ホスティング拡張に備えてドメインを設定しやすくする
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
