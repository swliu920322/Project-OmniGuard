import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🟩 1. 嗅探物理环境：判断当前是本地 dev 还是云端 build
const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 2. 动态锁死：本地开发时放开引擎 (undefined)，生产打包时刚性锁死静态 (export)
  output: isDev ? undefined : 'export',
  images: { unoptimized: true },
  trailingSlash: true,

  // 🎯 强制转译这几个 ESM 依赖以使 SWC/Webpack 兼容 import.meta 语法
  transpilePackages: [],

  // 🎯 【新增强调防护罩】：刚性宣告禁止 Next.js 服务端组件去打包 transformers 内部的重型二进制
  experimental: {
    serverComponentsExternalPackages: ['@huggingface/transformers'],
  },

  // 3. 强行重焊 Webpack 编译引擎
  webpack: (config, { isServer }) => {
    // 🟩 保持原有配置并增加别名指针：将 onnxruntime-web 强制指向 CommonJS 绝对物理路径，避免 Webpack 触发 package exports 检查并绕过 ESM 的 import.meta 报错
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname, './src'),
      'onnxruntime-web/webgpu$': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.webgpu.min.js'),
      'onnxruntime-web$': path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/ort.min.js'),
    };

		// 🎯 【核心绝杀】：让 Webpack 5 原生以纯文本字符串（type: 'asset/source'）读取全量 .bicep 文件
    // 这能彻底斩断在 TS 里人肉拼写字符串的业余做法
    config.module.rules.push({
      test: /\.bicep$/,
      type: 'asset/source',
    });

    // 🟩 核心拦截：当编译目标为客户端浏览器 (!isServer) 时，强行将 node 原生二进制包降维抹除
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        // 🎯 刚性绝杀：将导致浏览器解析崩溃的 native 动态链接库标记为 false，Webpack 编译遭遇它时直接跳过
        'onnxruntime-node': false,
      };
    }

    // 🟩 辅助规约：告诉 Webpack 即使在 Node 服务端侧，也要无害化看待 .node 二进制文件
    config.module.rules.push({
      test: /\.node$/,
      use: 'raw-loader',
    });

    return config;
  },

  // 4. 🎯 【核心网桥】：仅在本地开发态开启，强行将 3000 端口的流量倾泻给 7071 真机模拟器
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