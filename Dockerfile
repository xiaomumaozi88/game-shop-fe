# 多阶段构建：构建阶段
FROM node:18-alpine AS builder

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production=false

# 复制源代码
COPY . .

# 构建应用
# 根据环境变量选择构建命令
ARG BUILD_ENV=prod
RUN if [ "$BUILD_ENV" = "test" ]; then \
      npm run build:test; \
    else \
      npm run build; \
    fi

# 生产阶段：使用 Nginx 提供服务
FROM nginx:alpine

# 复制构建产物到 Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置（如果需要自定义）
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露端口
EXPOSE 80

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]

