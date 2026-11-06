import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🟩 1. 嗅探物理环境：判断当前是本地 dev 还是云端 build
const isDev = process.env.NODE_ENV === 'development';
const backendUrl = process.env.BACKEND_API_URL || 'http://localhost:7071';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 2. 动态锁死：生产打包时采用 standalone 格式以机制优化容器镜像体积
  output: isDev ? undefined : 'standalone',
  images: { unoptimized: true },
  trailingSlash: true,

  // 🎯 强制转译这几个 ESM 依赖以使 SWC/Webpack 兼容 import.meta 语法
  transpilePackages: [],

  // 3. 强行重焊 Webpack 编译引擎
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
    };

    // 🟩 核心拦截：当编译目标为客户端浏览器 (!isServer) 时，强行将 node 原生二进制包降维抹除
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },

};

export default nextConfig;