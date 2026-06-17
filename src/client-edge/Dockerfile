# === 阶段一：依赖安装 ===
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# === 阶段二：生产打包 ===
FROM node:18-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
# 刚性执行静态导出
RUN npm run build

# === 阶段三：静态分发（利用 Nginx 充当边缘节点） ===
FROM nginx:stable-alpine AS runner
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]