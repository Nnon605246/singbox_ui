# sing-box 入站协议完整分析

本文档详细分析 sing-box 支持的所有入站协议，包括其抗封锁能力、特性和适用场景。

---

## 协议总览表

### 代理协议对比

| 协议 | 抗封锁 | 传输层 | TLS | 多路复用 | 认证方式 | 特殊能力 | 适用场景 |
|------|--------|--------|-----|----------|----------|----------|----------|
| **VLESS** | 中高 | TCP/WS/H2/gRPC/QUIC | 可选 | 支持 | UUID | Vision流控, Reality | 通用, 低延迟 |
| **VMess** | 中 | TCP/WS/H2/gRPC/QUIC | 可选 | 支持 | UUID+alterId | AEAD加密 | 兼容性好 |
| **Trojan** | 中高 | TCP/WS/H2/gRPC | 必须 | 支持 | 密码 | Fallback回落 | 伪装HTTPS |
| **Shadowsocks** | 中 | TCP/UDP | 无 | 支持 | 密码 | SS-2022, 多用户, 中继 | 轻量级 |
| **Hysteria** | 高 | QUIC | 必须 | 原生 | 密码 | 带宽控制, Obfs混淆 | 高丢包网络 |
| **Hysteria2** | 非常高 | QUIC | 必须 | 原生 | 密码 | Salamander混淆, Masquerade伪装 | 高审查环境 |
| **TUIC** | 高 | QUIC | 必须 | 原生 | UUID+密码 | 0-RTT, BBR拥塞控制 | 高丢包网络 |
| **NaiveProxy** | 非常高 | QUIC/TCP | 必须 | 原生 | 用户名+密码 | Chromium网络栈 | 最强指纹抵抗 |
| **ShadowTLS** | 非常高 | TCP | 握手劫持 | - | 密码 | 真实TLS握手, v3多用户 | 高审查环境 |
| **AnyTLS** | 高 | TCP | 必须 | - | 密码 | 自定义Padding填充 | 流量分析对抗 |

### 本地/透明代理对比

| 协议 | 类型 | 平台支持 | TCP | UDP | 认证 | 特殊能力 |
|------|------|----------|-----|-----|------|----------|
| **Mixed** | 本地代理 | 全平台 | 支持 | - | 用户名+密码 | HTTP+SOCKS5单端口 |
| **SOCKS** | 本地代理 | 全平台 | 支持 | SOCKS5支持 | 用户名+密码 | SOCKS4/4a/5 |
| **HTTP** | 本地代理 | 全平台 | 支持 | - | Basic Auth | HTTPS代理 |
| **Direct** | 端口转发 | 全平台 | 支持 | 支持 | - | 简单转发 |
| **TUN** | 透明代理 | Linux/Win/macOS/Android/iOS | 支持 | 支持 | - | auto_route, auto_redirect, 按应用分流 |
| **TProxy** | 透明代理 | 仅Linux | 支持 | 支持 | - | iptables TPROXY |
| **Redirect** | 透明代理 | Linux/macOS | 支持 | - | - | iptables REDIRECT |

### 抗封锁能力详细对比

| 协议 | 抗封锁等级 | TLS指纹 | 流量特征 | 主动探测防护 | 深度包检测(DPI) | 推荐指数 |
|------|------------|---------|----------|--------------|-----------------|----------|
| **NaiveProxy** | ★★★★★ | Chromium原生 | 与Chrome一致 | 极强 | 极强 | ★★★★★ |
| **ShadowTLS v3** | ★★★★★ | 真实握手 | 与正常HTTPS一致 | 极强 | 极强 | ★★★★★ |
| **Hysteria2+Masq** | ★★★★☆ | 标准QUIC | QUIC混淆 | 强(伪装网站) | 强 | ★★★★☆ |
| **VLESS+Reality** | ★★★★☆ | 借用真实站点 | 与目标站一致 | 强 | 强 | ★★★★☆ |
| **AnyTLS** | ★★★★☆ | 标准TLS | 自定义填充 | 中 | 强 | ★★★☆☆ |
| **TUIC** | ★★★★☆ | 标准QUIC | QUIC协议 | 中 | 中 | ★★★★☆ |
| **Trojan+Fallback** | ★★★☆☆ | 标准TLS | 类HTTPS | 强(回落) | 中 | ★★★☆☆ |
| **VLESS Vision** | ★★★☆☆ | 标准TLS | TLS填充 | 中 | 中 | ★★★☆☆ |
| **Hysteria** | ★★★☆☆ | 标准QUIC | QUIC+Obfs | 弱 | 中 | ★★★☆☆ |
| **Shadowsocks-2022** | ★★★☆☆ | 无TLS | 加密流量 | 弱 | 中 | ★★★☆☆ |
| **VMess AEAD** | ★★☆☆☆ | 可选uTLS | 特定格式 | 弱 | 弱 | ★★☆☆☆ |

### 性能与功能对比

| 协议 | 延迟 | 吞吐量 | 弱网表现 | CPU占用 | 内存占用 | 客户端支持 |
|------|------|--------|----------|---------|----------|------------|
| **VLESS** | 极低 | 高 | 一般 | 低 | 低 | 广泛 |
| **VMess** | 低 | 高 | 一般 | 中 | 低 | 最广泛 |
| **Trojan** | 极低 | 高 | 一般 | 低 | 低 | 广泛 |
| **Shadowsocks** | 极低 | 极高 | 一般 | 极低 | 极低 | 最广泛 |
| **Hysteria/Hy2** | 中 | 极高 | 极好 | 中 | 中 | 中等 |
| **TUIC** | 中 | 高 | 好 | 中 | 中 | 中等 |
| **NaiveProxy** | 中 | 高 | 好 | 高 | 高 | 有限 |
| **ShadowTLS** | 低 | 高 | 一般 | 低 | 低 | 有限 |

### TLS 增强特性对比

| 特性 | 功能 | 抗封锁效果 | 性能影响 | 推荐度 |
|------|------|------------|----------|--------|
| **Reality** | 借用真实站点TLS握手 | 极强 | 低 | ★★★★★ |
| **ECH** | 加密ClientHello/SNI | 强 | 低 | ★★★★☆ |
| **Fragment** | TLS握手分片 | 中(简单防火墙) | 中 | ★★★☆☆ |
| **Record Fragment** | TLS记录分片 | 中 | 低 | ★★★☆☆ |
| **uTLS** | TLS指纹模拟 | 弱(已知漏洞) | 低 | ★☆☆☆☆ |

### V2Ray Transport 对比

| 传输层 | 协议 | TLS要求 | CDN支持 | 性能 | 隐蔽性 |
|--------|------|---------|---------|------|--------|
| **HTTP** | HTTP/2 | 推荐 | 支持 | 高 | 高 |
| **WebSocket** | WebSocket | 可选 | 支持 | 中 | 高 |
| **gRPC** | gRPC | 推荐 | 部分支持 | 高 | 高 |
| **HTTPUpgrade** | HTTP Upgrade | 可选 | 支持 | 中 | 高 |
| **QUIC** | QUIC | 必须 | 不支持 | 高 | 中 |

---

## 一、代理协议 (Proxy Protocols)

### 1. VLESS

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 中高 |
| **认证方式** | UUID |
| **Flow 模式** | 支持 `xtls-rprx-vision` (VLESS Vision) |
| **TLS 支持** | 标准 TLS / Reality / ECH |
| **多路复用** | 支持 |
| **传输层** | HTTP / WebSocket / QUIC / gRPC / HTTPUpgrade |

#### 配置示例

```json
{
  "type": "vless",
  "tag": "vless-in",
  "listen": "::",
  "listen_port": 443,
  "users": [
    {
      "name": "user1",
      "uuid": "bf000d23-0752-40b4-affe-68f7707a9661",
      "flow": "xtls-rprx-vision"
    }
  ],
  "tls": {},
  "multiplex": {},
  "transport": {}
}
```

#### 抗封锁特性

- **VLESS Vision** (`xtls-rprx-vision`): 通过读取内层 TLS ClientHello 长度来填充外层 TLS 流量，隐藏 TLS-in-TLS 特征
- **Reality**: 无需证书，使用真实网站 TLS 握手进行伪装，是目前最先进的伪装技术之一

---

### 2. VMess

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 中 |
| **认证方式** | UUID + alterId |
| **加密方式** | AEAD (推荐 alterId=0) |
| **TLS 支持** | 标准 TLS |
| **多路复用** | 支持 |
| **传输层** | HTTP / WebSocket / QUIC / gRPC / HTTPUpgrade |

#### 配置示例

```json
{
  "type": "vmess",
  "tag": "vmess-in",
  "listen": "::",
  "listen_port": 443,
  "users": [
    {
      "name": "user1",
      "uuid": "bf000d23-0752-40b4-affe-68f7707a9661",
      "alterId": 0
    }
  ],
  "tls": {},
  "multiplex": {},
  "transport": {}
}
```

#### 注意事项

- `alterId` 建议设为 0 以启用 AEAD 加密，提高安全性
- 较老的协议，但兼容性好，客户端支持广泛

---

### 3. Trojan

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 中高 |
| **认证方式** | 密码 |
| **TLS 支持** | 必须启用 TLS |
| **多路复用** | 支持 |
| **传输层** | 支持 V2Ray Transport |
| **回落功能** | 支持 fallback 和 ALPN 回落 |

#### 配置示例

```json
{
  "type": "trojan",
  "tag": "trojan-in",
  "listen": "::",
  "listen_port": 443,
  "users": [
    {
      "name": "user1",
      "password": "your-password-here"
    }
  ],
  "tls": {},
  "fallback": {
    "server": "127.0.0.1",
    "server_port": 8080
  },
  "fallback_for_alpn": {
    "http/1.1": {
      "server": "127.0.0.1",
      "server_port": 8081
    }
  },
  "multiplex": {},
  "transport": {}
}
```

#### 抗封锁特性

- 设计为模拟 HTTPS 流量
- **fallback**: 当非 Trojan 流量到达时，可以将流量转发到真实网站（如 Nginx），有效防止主动探测
- **ALPN 回落**: 根据 ALPN 将流量分流到不同后端

---

### 4. Shadowsocks

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 中 |
| **认证方式** | 密码 |
| **加密方法** | 2022-blake3-* (推荐) / Legacy methods |
| **多用户** | 支持 (SS-2022) |
| **多路复用** | 支持 |
| **中继模式** | 支持 |

#### 加密方法列表

| 方法 | 密钥长度 | 推荐度 |
|------|----------|--------|
| `2022-blake3-aes-128-gcm` | 16 | 推荐 |
| `2022-blake3-aes-256-gcm` | 32 | 推荐 |
| `2022-blake3-chacha20-poly1305` | 32 | 推荐 |
| `aes-128-gcm` | - | Legacy |
| `aes-256-gcm` | - | Legacy |
| `chacha20-ietf-poly1305` | - | Legacy |

#### 配置示例

```json
{
  "type": "shadowsocks",
  "tag": "ss-in",
  "listen": "::",
  "listen_port": 8388,
  "method": "2022-blake3-aes-128-gcm",
  "password": "8JCsPssfgS8tiRwiMlhARg==",
  "multiplex": {}
}
```

#### 多用户配置

```json
{
  "type": "shadowsocks",
  "method": "2022-blake3-aes-128-gcm",
  "password": "8JCsPssfgS8tiRwiMlhARg==",
  "users": [
    {
      "name": "user1",
      "password": "PCD2Z4o12bKUoFa3cC97Hw=="
    }
  ],
  "multiplex": {}
}
```

---

### 5. Hysteria (QUIC-based)

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 高 |
| **传输协议** | QUIC |
| **带宽控制** | 必须指定 up/down |
| **混淆** | 支持 obfs 密码 |
| **TLS** | 必须启用 |
| **适用场景** | 高丢包/高延迟网络 |

#### 配置示例

```json
{
  "type": "hysteria",
  "tag": "hysteria-in",
  "listen": "::",
  "listen_port": 443,
  "up": "100 Mbps",
  "down": "100 Mbps",
  "obfs": "your-obfs-password",
  "users": [
    {
      "name": "user1",
      "auth_str": "password"
    }
  ],
  "tls": {}
}
```

#### 抗封锁特性

- 基于 QUIC，天然抗封锁
- 支持流量混淆 (`obfs`)
- 针对网络不稳定环境优化
- 适合高丢包率、高延迟的网络环境

---

### 6. Hysteria2 (改进版)

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 非常高 |
| **传输协议** | QUIC |
| **混淆类型** | `salamander` |
| **拥塞控制** | BBR / Brutal |
| **伪装功能** | 支持 masquerade |

#### 配置示例

```json
{
  "type": "hysteria2",
  "tag": "hy2-in",
  "listen": "::",
  "listen_port": 443,
  "up_mbps": 100,
  "down_mbps": 100,
  "obfs": {
    "type": "salamander",
    "password": "your-obfs-password"
  },
  "users": [
    {
      "name": "user1",
      "password": "your-password"
    }
  ],
  "ignore_client_bandwidth": false,
  "tls": {},
  "masquerade": "https://www.microsoft.com"
}
```

#### Masquerade 伪装配置

认证失败时可伪装为:

| 类型 | 配置示例 | 说明 |
|------|----------|------|
| 文件服务器 | `file:///var/www` | 作为静态文件服务器 |
| 反向代理 | `http://127.0.0.1:8080` | 代理到后端服务 |
| 固定响应 | 对象配置 | 返回自定义响应 |

#### 对象形式伪装配置

```json
{
  "masquerade": {
    "type": "proxy",
    "url": "https://www.microsoft.com",
    "rewrite_host": true
  }
}
```

#### 抗封锁特性

- **Salamander 混淆**: 使用密码对 QUIC 流量进行混淆
- **Masquerade 伪装**: 防主动探测能力强
- 相比 Hysteria v1 有更好的性能和安全性

---

### 7. TUIC (QUIC-based)

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 高 |
| **传输协议** | QUIC |
| **认证方式** | UUID + 密码 |
| **拥塞控制** | `cubic`, `new_reno`, `bbr` |
| **0-RTT** | 支持 (不建议启用) |
| **TLS** | 必须启用 |

#### 配置示例

```json
{
  "type": "tuic",
  "tag": "tuic-in",
  "listen": "::",
  "listen_port": 443,
  "users": [
    {
      "name": "user1",
      "uuid": "059032A9-7D40-4A96-9BB1-36823D848068",
      "password": "your-password"
    }
  ],
  "congestion_control": "bbr",
  "auth_timeout": "3s",
  "zero_rtt_handshake": false,
  "heartbeat": "10s",
  "tls": {}
}
```

#### 注意事项

- `zero_rtt_handshake` 存在重放攻击风险，建议保持禁用
- 拥塞控制推荐使用 `bbr`

---

### 8. NaiveProxy

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 非常高 |
| **底层实现** | Chromium 网络栈 |
| **QUIC 拥塞控制** | `bbr` (默认), `cubic`, `reno` 等 |
| **TLS** | 必须启用 |
| **指纹抵抗** | 最强 |

#### 配置示例

```json
{
  "type": "naive",
  "tag": "naive-in",
  "listen": "::",
  "listen_port": 443,
  "users": [
    {
      "username": "user1",
      "password": "password"
    }
  ],
  "quic_congestion_control": "bbr",
  "tls": {}
}
```

#### QUIC 拥塞控制算法

| 算法 | 说明 |
|------|------|
| `bbr` | BBR (默认，Chromium 使用) |
| `bbr_standard` | BBR 标准版本 |
| `bbr2` | BBRv2 |
| `bbr2_variant` | BBRv2 实验变体 |
| `cubic` | CUBIC |
| `reno` | New Reno |

#### 抗封锁特性

- 使用 **Chromium 网络栈**，TLS 指纹与真实 Chrome 浏览器完全一致
- sing-box 文档明确指出：对于 TLS 指纹抵抗，**推荐使用 NaiveProxy**
- uTLS 已被发现多次指纹识别漏洞，不如 NaiveProxy 可靠

---

### 9. ShadowTLS

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 非常高 |
| **类型** | TLS 握手劫持 |
| **版本** | v1, v2, v3 |
| **通配符 SNI** | 支持 (`authed`, `all`) |
| **严格模式** | v3 支持 |

#### 配置示例 (v3)

```json
{
  "type": "shadowtls",
  "tag": "st-in",
  "listen": "::",
  "listen_port": 443,
  "version": 3,
  "users": [
    {
      "name": "user1",
      "password": "your-password"
    }
  ],
  "handshake": {
    "server": "www.microsoft.com",
    "server_port": 443
  },
  "strict_mode": true,
  "wildcard_sni": "authed"
}
```

#### 版本对比

| 版本 | 特性 |
|------|------|
| v1 | 基础 TLS 握手劫持 |
| v2 | 支持密码认证、handshake_for_server_name |
| v3 | 支持多用户、严格模式、通配符 SNI |

#### Wildcard SNI 模式

| 值 | 说明 |
|------|------|
| `off` | 禁用 (默认) |
| `authed` | 已认证连接的目标重写为 `(servername):443` |
| `all` | 所有连接的目标重写为 `(servername):443` |

#### 抗封锁特性

- **TLS 握手劫持**: 与真实域名 (如 microsoft.com) 进行真实 TLS 握手
- 流量特征与访问正常 HTTPS 网站完全一致
- 通常与 Shadowsocks 配合使用，ShadowTLS 作为外层包装

---

### 10. AnyTLS (实验性)

| 特性 | 说明 |
|------|------|
| **抗封锁能力** | 高 |
| **类型** | 自定义填充 |
| **TLS** | 必须启用 |
| **版本** | sing-box 1.12.0+ |

#### 配置示例

```json
{
  "type": "anytls",
  "tag": "anytls-in",
  "listen": "::",
  "listen_port": 443,
  "users": [
    {
      "name": "user1",
      "password": "your-password"
    }
  ],
  "padding_scheme": [
    "stop=8",
    "0=30-30",
    "1=100-400",
    "2=400-500,c,500-1000,c,500-1000,c,500-1000,c,500-1000",
    "3=9-9,500-1000",
    "4=500-1000",
    "5=500-1000",
    "6=500-1000",
    "7=500-1000"
  ],
  "tls": {}
}
```

#### Padding Scheme 说明

- 可配置每个包的填充规则
- 格式: `序号=最小长度-最大长度`
- `c` 表示继续下一个包的填充
- `stop=N` 表示在第 N 个包后停止填充

#### 抗封锁特性

- 支持自定义 **padding scheme** 进行流量填充
- 对抗流量分析和特征检测
- 设计目标是使流量难以被识别

---

## 二、本地代理协议

### 11. Mixed (HTTP + SOCKS5)

| 特性 | 说明 |
|------|------|
| **功能** | 单端口同时支持 HTTP 和 SOCKS5 |
| **认证** | 支持用户名/密码 |
| **系统代理** | 可自动设置 |

#### 配置示例

```json
{
  "type": "mixed",
  "tag": "mixed-in",
  "listen": "127.0.0.1",
  "listen_port": 1080,
  "users": [
    {
      "username": "user1",
      "password": "password"
    }
  ]
}
```

---

### 12. SOCKS

| 特性 | 说明 |
|------|------|
| **版本** | SOCKS4, SOCKS4a, SOCKS5 |
| **UDP** | SOCKS5 支持 |
| **认证** | 支持用户名/密码 |

#### 配置示例

```json
{
  "type": "socks",
  "tag": "socks-in",
  "listen": "127.0.0.1",
  "listen_port": 1080,
  "users": [
    {
      "username": "user1",
      "password": "password"
    }
  ]
}
```

---

### 13. HTTP

| 特性 | 说明 |
|------|------|
| **功能** | 标准 HTTP 代理 |
| **TLS** | 支持 HTTPS 代理 |
| **认证** | 支持 Basic Auth |

#### 配置示例

```json
{
  "type": "http",
  "tag": "http-in",
  "listen": "127.0.0.1",
  "listen_port": 8080,
  "users": [
    {
      "username": "user1",
      "password": "password"
    }
  ],
  "tls": {}
}
```

---

### 14. Direct

| 特性 | 说明 |
|------|------|
| **功能** | 端口转发 |
| **用途** | 监听端口直接转发到目标地址 |

#### 配置示例

```json
{
  "type": "direct",
  "tag": "direct-in",
  "listen": "::",
  "listen_port": 8080,
  "override_address": "1.1.1.1",
  "override_port": 53
}
```

---

## 三、透明代理

### 15. TUN (虚拟网卡)

| 特性 | 说明 |
|------|------|
| **平台** | Linux, Windows, macOS, Android, iOS |
| **网络栈** | `system`, `gvisor`, `mixed` |
| **auto_route** | 自动配置系统路由 |
| **auto_redirect** | Linux nftables 高性能转发 |

#### 网络栈对比

| 栈类型 | 说明 |
|--------|------|
| `system` | 使用系统网络栈进行 L3 到 L4 转换 |
| `gvisor` | 使用 gVisor 虚拟网络栈 |
| `mixed` | TCP 使用 system，UDP 使用 gvisor (默认) |

#### 配置示例

```json
{
  "type": "tun",
  "tag": "tun-in",
  "interface_name": "tun0",
  "address": [
    "172.18.0.1/30",
    "fdfe:dcba:9876::1/126"
  ],
  "mtu": 9000,
  "auto_route": true,
  "auto_redirect": true,
  "strict_route": true,
  "stack": "mixed",
  "exclude_package": [
    "com.android.captiveportallogin"
  ]
}
```

#### 特殊能力

- 支持按 UID / 包名 / 接口过滤
- Android 支持按应用分流 (`include_package`, `exclude_package`)
- `auto_redirect` 提供比 TProxy 更好的性能，推荐在 Linux 上启用
- 支持 `route_address_set` 和 `route_exclude_address_set` 实现精细路由

---

### 16. TProxy (Linux only)

| 特性 | 说明 |
|------|------|
| **平台** | 仅 Linux |
| **功能** | iptables TPROXY 透明代理 |
| **支持** | TCP + UDP |

#### 配置示例

```json
{
  "type": "tproxy",
  "tag": "tproxy-in",
  "listen": "::",
  "listen_port": 1080
}
```

---

### 17. Redirect (Linux/macOS)

| 特性 | 说明 |
|------|------|
| **平台** | Linux, macOS |
| **功能** | iptables REDIRECT 透明代理 |
| **支持** | 仅 TCP |

#### 配置示例

```json
{
  "type": "redirect",
  "tag": "redirect-in",
  "listen": "::",
  "listen_port": 1080
}
```

---

## 四、TLS 增强特性

### Reality

无需证书，借用真实网站 TLS 握手进行伪装。

```json
{
  "tls": {
    "enabled": true,
    "reality": {
      "enabled": true,
      "handshake": {
        "server": "www.microsoft.com",
        "server_port": 443
      },
      "private_key": "your-private-key",
      "short_id": ["0123456789abcdef"],
      "max_time_difference": "1m"
    }
  }
}
```

### ECH (Encrypted Client Hello)

加密 SNI，防止 SNI 嗅探。

```json
{
  "tls": {
    "enabled": true,
    "ech": {
      "enabled": true,
      "key": [],
      "key_path": "/path/to/ech-key.pem"
    }
  }
}
```

### TLS Fragment

TLS 分片绕过简单防火墙。

```json
{
  "tls": {
    "enabled": true,
    "fragment": true,
    "fragment_fallback_delay": "500ms",
    "record_fragment": true
  }
}
```

### uTLS (不推荐)

TLS 指纹模拟，但存在已知漏洞。

```json
{
  "tls": {
    "enabled": true,
    "utls": {
      "enabled": true,
      "fingerprint": "chrome"
    }
  }
}
```

> **警告**: sing-box 文档明确指出 uTLS 已被发现多次指纹识别漏洞，推荐使用 NaiveProxy 代替。

---

## 五、V2Ray Transport 传输层

| 类型 | 说明 | TLS 要求 |
|------|------|----------|
| HTTP | HTTP/2 传输 | 推荐 TLS |
| WebSocket | WebSocket 传输 | 可选 TLS |
| QUIC | QUIC 传输 | 必须 TLS |
| gRPC | gRPC 传输 | 推荐 TLS |
| HTTPUpgrade | HTTP Upgrade 传输 | 可选 TLS |

### WebSocket 配置示例

```json
{
  "transport": {
    "type": "ws",
    "path": "/ws",
    "headers": {
      "Host": "example.com"
    },
    "max_early_data": 2048,
    "early_data_header_name": "Sec-WebSocket-Protocol"
  }
}
```

### gRPC 配置示例

```json
{
  "transport": {
    "type": "grpc",
    "service_name": "TunService",
    "idle_timeout": "15s",
    "ping_timeout": "15s"
  }
}
```

---

## 六、抗封锁能力排名

| 等级 | 协议 | 说明 |
|------|------|------|
| **最强** | NaiveProxy | Chromium 网络栈，指纹最真实 |
| **非常高** | ShadowTLS v3 | 真实 TLS 握手劫持 |
| **非常高** | Hysteria2 + masquerade | QUIC + 伪装网站 |
| **高** | VLESS + Reality | 无需证书的高级伪装 |
| **高** | TUIC | QUIC 协议 |
| **高** | AnyTLS | 自定义填充方案 |
| **中高** | Trojan + fallback | 回落到真实网站 |
| **中高** | VLESS Vision | TLS-in-TLS 特征隐藏 |
| **中** | Shadowsocks-2022 | 现代加密，无明显特征 |
| **中** | VMess AEAD | 较老但仍可用 |

---

## 七、使用场景建议

### 高审查环境

推荐顺序:
1. **NaiveProxy** - Chromium 网络栈，TLS 指纹最真实
2. **ShadowTLS v3 + Shadowsocks** - 真实 TLS 握手
3. **Hysteria2 + masquerade** - QUIC 伪装

### 高丢包/高延迟网络

推荐顺序:
1. **Hysteria2** - 专为不稳定网络优化
2. **Hysteria** - 早期版本，仍然有效
3. **TUIC** - QUIC 协议，表现稳定

### 低延迟需求

推荐:
- **VLESS** / **Trojan** - TCP 开销低，延迟最小

### 移动设备

推荐:
- **TUN + gvisor 网络栈** - 最佳兼容性
- 配合 `include_package` / `exclude_package` 实现按应用分流

### 路由器/网关

推荐:
- **TUN + auto_redirect** - 最佳性能，推荐 Linux
- **TProxy** - 传统方案，兼容性好

---

## 八、安全建议

1. **始终使用 TLS 1.3** - 设置 `min_version: "1.3"`
2. **避免使用 uTLS** - 已知存在指纹识别漏洞
3. **禁用 0-RTT** - 存在重放攻击风险
4. **启用严格模式** - ShadowTLS v3 的 `strict_mode`
5. **使用强密码** - 特别是 Shadowsocks-2022 的 base64 密钥
6. **定期更新** - 保持 sing-box 版本最新

---

## 九、Endpoint 协议 (sing-box 1.11.0+)

Endpoint 是 sing-box 1.11.0 引入的新概念，**同时具备入站和出站行为**，配置在 `endpoints` 数组中。

### 协议总览

| 协议 | 版本要求 | 功能 | 适用场景 |
|------|----------|------|----------|
| **WireGuard** | 1.11.0+ | VPN隧道 | 点对点连接、组网 |
| **Tailscale** | 1.12.0+ | Mesh网络 | 零配置组网、远程访问 |

---

### 18. WireGuard Endpoint

| 特性 | 说明 |
|------|------|
| **版本要求** | sing-box 1.11.0+ |
| **类型** | VPN 隧道协议 |
| **系统接口** | 可选使用系统 TUN |
| **多 Peer** | 支持多个对等节点 |

#### 配置示例

```json
{
  "endpoints": [
    {
      "type": "wireguard",
      "tag": "wg-ep",
      "system": false,
      "mtu": 1408,
      "address": ["10.0.0.1/24"],
      "private_key": "your-private-key-base64",
      "listen_port": 51820,
      "peers": [
        {
          "address": "remote-peer-ip",
          "port": 51820,
          "public_key": "peer-public-key-base64",
          "pre_shared_key": "",
          "allowed_ips": ["0.0.0.0/0"],
          "persistent_keepalive_interval": 25,
          "reserved": [0, 0, 0]
        }
      ],
      "udp_timeout": "5m",
      "workers": 0
    }
  ]
}
```

#### 字段说明

| 字段 | 必填 | 说明 |
|------|------|------|
| `system` | 否 | 使用系统 TUN 设备，需要特权 |
| `name` | 否 | 系统接口自定义名称 |
| `mtu` | 否 | MTU，默认 1408 |
| `address` | **是** | 接口 IPv4/IPv6 地址列表 |
| `private_key` | **是** | Base64 编码的私钥 |
| `listen_port` | 否 | 监听端口 |
| `peers` | **是** | 对等节点列表 |
| `udp_timeout` | 否 | UDP NAT 超时，默认 5m |
| `workers` | 否 | Worker 数量，默认 CPU 核数 |

#### Peer 字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `address` | 否 | 对端 IP 地址 |
| `port` | 否 | 对端端口 |
| `public_key` | **是** | 对端公钥 |
| `pre_shared_key` | 否 | 预共享密钥 |
| `allowed_ips` | **是** | 允许的 IP 范围 |
| `persistent_keepalive_interval` | 否 | 保活间隔(秒) |
| `reserved` | 否 | 保留字段 (Cloudflare WARP 使用) |

#### 密钥生成

```bash
# 使用 wg 工具
wg genkey > private.key
cat private.key | wg pubkey > public.key

# 或使用 sing-box
sing-box generate wg-keypair
```

---

### 19. Tailscale Endpoint

| 特性 | 说明 |
|------|------|
| **版本要求** | sing-box 1.12.0+ |
| **类型** | Mesh VPN 网络 |
| **认证** | Auth Key 或登录 URL |
| **自建支持** | 支持 Headscale |

#### 配置示例

```json
{
  "endpoints": [
    {
      "type": "tailscale",
      "tag": "ts-ep",
      "state_directory": "/var/lib/tailscale",
      "auth_key": "",
      "control_url": "",
      "ephemeral": false,
      "hostname": "sing-box-node",
      "accept_routes": false,
      "exit_node": "",
      "exit_node_allow_lan_access": false,
      "advertise_routes": [],
      "advertise_exit_node": false,
      "udp_timeout": "5m"
    }
  ]
}
```

#### 字段说明

| 字段 | 说明 |
|------|------|
| `state_directory` | 状态存储目录，默认 `tailscale` |
| `auth_key` | 认证密钥 (可选，不填会显示登录 URL) |
| `control_url` | 控制服务器 URL (默认 Tailscale 官方，可用于 Headscale) |
| `ephemeral` | 是否注册为临时节点 |
| `hostname` | 节点主机名 |
| `accept_routes` | 是否接受其他节点通告的路由 |
| `exit_node` | 要使用的出口节点名称或 IP |
| `exit_node_allow_lan_access` | 使用出口节点时是否允许访问本地网络 |
| `advertise_routes` | 通告到 Tailscale 网络的路由，如 `["192.168.1.0/24"]` |
| `advertise_exit_node` | 是否将自己通告为出口节点 |
| `udp_timeout` | UDP NAT 超时，默认 5m |

#### 1.13.0+ 新增字段

| 字段 | 说明 |
|------|------|
| `relay_server_port` | 监听中继连接的端口 |
| `relay_server_static_endpoints` | 中继服务器静态端点 |
| `system_interface` | 创建系统 TUN 接口 |
| `system_interface_name` | TUN 接口名 (默认 `tailscale`) |
| `system_interface_mtu` | 覆盖 TUN MTU |

#### 使用场景

1. **连接 Tailscale 网络** - 让 sing-box 加入 Tailscale mesh 网络
2. **自建 Headscale** - 通过 `control_url` 连接自建协调服务器
3. **作为出口节点** - 设置 `advertise_exit_node: true`
4. **共享内网** - 通过 `advertise_routes` 共享本地网段

#### 自建 Headscale 示例

```json
{
  "type": "tailscale",
  "tag": "ts-headscale",
  "control_url": "https://headscale.example.com",
  "auth_key": "your-headscale-auth-key",
  "hostname": "my-node"
}
```

---

### Endpoint vs Inbound/Outbound

| 特性 | Inbound | Outbound | Endpoint |
|------|---------|----------|----------|
| 接收连接 | 是 | 否 | 是 |
| 发起连接 | 否 | 是 | 是 |
| 配置位置 | `inbounds` | `outbounds` | `endpoints` |
| 典型协议 | VLESS, VMess | VLESS, VMess, Direct | WireGuard, Tailscale |

> **注意**: WireGuard 在 sing-box 1.11.0+ 中从 inbound/outbound 迁移到了 endpoint，旧的配置方式已废弃。

---

## 十、参考资料

- [sing-box 官方文档](https://sing-box.sagernet.org/)
- [ShadowTLS 协议文档](https://github.com/ihciah/shadow-tls/blob/master/docs/protocol-en.md)
- [Hysteria2 官方文档](https://v2.hysteria.network/)
- [TUIC 协议](https://github.com/EAimTY/tuic)
- [NaiveProxy 项目](https://github.com/klzgrad/naiveproxy)
- [Tailscale 官方文档](https://tailscale.com/kb/)
- [Headscale 项目](https://github.com/juanfont/headscale)
