# Xray 配置生成器 - 前端

基于 Next.js 和 shadcn/ui 的 Xray 配置生成器前端界面。

## 功能特性

- 📱 现代化响应式 UI
- 🎨 基于 shadcn/ui 组件库
- ⚡ Next.js 14 App Router
- 🔑 WireGuard 密钥生成
- 📝 多种协议配置生成：
  - VLESS
  - VMess
  - Trojan
  - WireGuard

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **组件库**: shadcn/ui
- **图标**: Lucide React

## 快速开始

### 1. 安装依赖

```bash
cd frontend
npm install
```

### 2. 配置环境变量

创建 `.env.local` 文件：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local` 文件，设置后端 API 地址：

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### 3. 启动开发服务器

```bash
npm run dev
```

应用将在 `http://localhost:3000` 启动。

### 4. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
frontend/
├── app/                    # Next.js App Router
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页
├── components/            # React 组件
│   ├── ui/               # shadcn/ui 基础组件
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── tabs.tsx
│   │   └── textarea.tsx
│   ├── wireguard-keygen.tsx   # WireGuard 密钥生成
│   ├── vless-config.tsx       # VLESS 配置生成
│   ├── vmess-config.tsx       # VMess 配置生成
│   ├── trojan-config.tsx      # Trojan 配置生成
│   └── wireguard-config.tsx   # WireGuard 配置生成
├── lib/                   # 工具函数
│   ├── api.ts            # API 客户端
│   └── utils.ts          # 通用工具
├── tailwind.config.ts    # Tailwind 配置
├── tsconfig.json         # TypeScript 配置
├── next.config.mjs       # Next.js 配置
└── package.json          # 项目依赖
```

## 使用说明

### WireGuard 密钥生成

1. 点击 "WireGuard 密钥" 标签
2. 点击 "生成密钥对" 按钮
3. 复制生成的私钥和公钥

### 配置生成

1. 选择对应的协议标签（VLESS/VMess/Trojan/WireGuard）
2. 填写必要的配置参数
3. 点击 "生成配置" 按钮
4. 复制生成的 JSON 配置

### 配置参数说明

#### VLESS
- **服务器地址**: 代理服务器域名或 IP
- **端口**: 服务器端口（默认 443）
- **UUID**: 用户 ID
- **Flow**: 流控模式（如 xtls-rprx-vision）
- **Network**: 传输协议（tcp/ws/grpc）
- **Security**: 加密方式（tls/reality）
- **SNI**: TLS 服务器名称

#### VMess
- **服务器地址**: 代理服务器域名或 IP
- **端口**: 服务器端口（默认 443）
- **UUID**: 用户 ID
- **Alter ID**: 额外 ID（默认 0）
- **Security**: 加密方式（auto/aes-128-gcm/chacha20-poly1305）
- **Network**: 传输协议（ws/tcp）
- **TLS**: 是否启用 TLS
- **SNI**: TLS 服务器名称

#### Trojan
- **服务器地址**: 代理服务器域名或 IP
- **端口**: 服务器端口（默认 443）
- **密码**: Trojan 密码
- **Network**: 传输协议（tcp/ws）
- **SNI**: TLS 服务器名称

#### WireGuard
- **私钥**: WireGuard 私钥（从密钥生成获取）
- **地址**: 本地 IP 地址（如 10.10.0.2/32）
- **MTU**: 最大传输单元（默认 1420）
- **对等节点**:
  - 公钥: 对端公钥
  - 端点: 服务器地址和端口
  - 允许的 IP: 路由范围（如 0.0.0.0/0）

## 开发

### 添加新组件

```bash
# 从 shadcn/ui 添加组件（如果需要）
npx shadcn-ui@latest add [component-name]
```

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 React Hooks 最佳实践
- 使用 Tailwind CSS 进行样式编写
- 组件采用函数式组件

## 部署

### Vercel 部署

1. 将项目推送到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量 `NEXT_PUBLIC_API_URL`
4. 部署

### Docker 部署

```bash
# 构建镜像
docker build -t xray-frontend .

# 运行容器
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://your-api:8080 xray-frontend
```

## 注意事项

- 确保后端 API 服务已启动
- 后端需要配置 CORS 允许前端域名访问
- 生产环境请使用 HTTPS

## 许可证

MIT License
