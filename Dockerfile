# 构建阶段:在单个容器中完成前端和后端构建
FROM golang:alpine AS builder

WORKDIR /app

# 安装 Node.js 和必要的构建工具
RUN apk add --no-cache nodejs npm git

# 构建前端
COPY frontend/ ./frontend/
WORKDIR /app/frontend
RUN npm ci && npx next build

# 构建后端
WORKDIR /app
COPY server/ ./server/
# 将前端构建产物复制到服务端 dist 目录
RUN cp -r frontend/out server/dist

WORKDIR /app/server
RUN go mod tidy && \
    CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o sing-box-ui .

# 运行时阶段:只包含编译好的二进制文件
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# 复制编译好的二进制文件
COPY --from=builder /app/server/sing-box-ui .

# 创建必要的目录
RUN mkdir -p /root/sing-box /root/wireguard

# 暴露端口
EXPOSE 8080

# 设置时区
ENV TZ=Asia/Shanghai

# 运行应用
CMD ["./sing-box-ui"]
