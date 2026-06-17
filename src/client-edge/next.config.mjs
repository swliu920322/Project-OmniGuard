import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🟩 嗅探物理环境：判断当前是本地 dev 还是云端 build
const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1. 动态锁死：本地开发时放开引擎 (undefined)，生产打包时刚性锁死静态 (export)
  output: isDev ? undefined : 'export',
  images: { unoptimized: true },
  trailingSlash: true,

  // 2. 强行重焊 Webpack 别名指针
  webpack: (config) => {
    config.resolve.alias['@'] = path.resolve(__dirname, './src');
    return config;
  },

  // 3. 🎯 【核心网桥】：仅在本地开发态开启，强行将 3000 端口的流量倾泻给 7071 真机模拟器
  ...(isDev && {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:7071/api/:path*',
        },
      ];
    },
  }),
};

export default nextConfig;