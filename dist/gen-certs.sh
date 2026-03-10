#!/bin/bash
#
# 生成 Docker Socket Proxy mTLS 双向证书
#
# 用法: ./gen-certs.sh [天数] [IP或域名]
#   天数: 证书有效期，默认 3650（10年）
#   IP或域名: docker-socket-proxy 所在服务器地址
#
# 生成目录结构:
#   certs/
#   ├── ca/          CA 根证书
#   │   ├── ca.pem
#   │   └── ca-key.pem
#   ├── server/      服务端证书（部署到 docker-socket-proxy）
#   │   ├── ca.pem
#   │   ├── server-cert.pem
#   │   └── server-key.pem
#   └── client/      客户端证书（部署到 singbox-ui）
#       ├── ca.pem
#       ├── cert.pem
#       └── key.pem
#

set -e

DAYS="${1:-3650}"
SERVER_HOST="${2:-}"

CERT_DIR="./certs"
CA_DIR="$CERT_DIR/ca"
SERVER_DIR="$CERT_DIR/server"
CLIENT_DIR="$CERT_DIR/client"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# 检查 openssl
command -v openssl >/dev/null 2>&1 || error "需要安装 openssl"

# 询问服务器地址
if [ -z "$SERVER_HOST" ]; then
    echo -n "请输入 docker-socket-proxy 服务器 IP 或域名: "
    read -r SERVER_HOST
fi
[ -z "$SERVER_HOST" ] && error "必须提供服务器地址"

info "证书有效期: ${DAYS} 天"
info "服务器地址: ${SERVER_HOST}"

# 创建目录
mkdir -p "$CA_DIR" "$SERVER_DIR" "$CLIENT_DIR"

# ===== 1. 生成 CA 根证书 =====
info "生成 CA 根证书..."
openssl genrsa -out "$CA_DIR/ca-key.pem" 4096

openssl req -new -x509 -days "$DAYS" \
    -key "$CA_DIR/ca-key.pem" \
    -out "$CA_DIR/ca.pem" \
    -subj "/CN=Docker Socket Proxy CA"

# ===== 2. 生成服务端证书 =====
info "生成服务端证书..."
openssl genrsa -out "$SERVER_DIR/server-key.pem" 4096

openssl req -new \
    -key "$SERVER_DIR/server-key.pem" \
    -out "$SERVER_DIR/server.csr" \
    -subj "/CN=docker-socket-proxy"

# 判断是 IP 还是域名
SAN=""
if echo "$SERVER_HOST" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'; then
    SAN="IP:${SERVER_HOST},IP:127.0.0.1"
else
    SAN="DNS:${SERVER_HOST},DNS:localhost,IP:127.0.0.1"
fi

openssl x509 -req -days "$DAYS" \
    -in "$SERVER_DIR/server.csr" \
    -CA "$CA_DIR/ca.pem" \
    -CAkey "$CA_DIR/ca-key.pem" \
    -CAcreateserial \
    -out "$SERVER_DIR/server-cert.pem" \
    -extfile <(echo "subjectAltName=${SAN}")

# 复制 CA 到 server 目录
cp "$CA_DIR/ca.pem" "$SERVER_DIR/ca.pem"

# 清理 CSR
rm -f "$SERVER_DIR/server.csr"

# ===== 3. 生成客户端证书 =====
info "生成客户端证书..."
openssl genrsa -out "$CLIENT_DIR/key.pem" 4096

openssl req -new \
    -key "$CLIENT_DIR/key.pem" \
    -out "$CLIENT_DIR/client.csr" \
    -subj "/CN=singbox-ui-client"

openssl x509 -req -days "$DAYS" \
    -in "$CLIENT_DIR/client.csr" \
    -CA "$CA_DIR/ca.pem" \
    -CAkey "$CA_DIR/ca-key.pem" \
    -CAcreateserial \
    -out "$CLIENT_DIR/cert.pem" \
    -extfile <(echo "extendedKeyUsage=clientAuth")

# 复制 CA 到 client 目录
cp "$CA_DIR/ca.pem" "$CLIENT_DIR/ca.pem"

# 清理 CSR
rm -f "$CLIENT_DIR/client.csr" "$CA_DIR/ca.srl"

# ===== 4. 设置权限 =====
chmod 600 "$CA_DIR/ca-key.pem" "$SERVER_DIR/server-key.pem" "$CLIENT_DIR/key.pem"
chmod 644 "$CA_DIR/ca.pem" "$SERVER_DIR/server-cert.pem" "$SERVER_DIR/ca.pem" \
          "$CLIENT_DIR/cert.pem" "$CLIENT_DIR/ca.pem"

# ===== 完成 =====
echo ""
info "===== 证书生成完成 ====="
echo ""
echo "目录结构:"
echo "  certs/"
echo "  ├── ca/              CA 根证书（妥善保管）"
echo "  │   ├── ca.pem"
echo "  │   └── ca-key.pem"
echo "  ├── server/          → 部署到 docker-socket-proxy 服务器"
echo "  │   ├── ca.pem"
echo "  │   ├── server-cert.pem"
echo "  │   └── server-key.pem"
echo "  └── client/          → 部署到 singbox-ui 服务器"
echo "      ├── ca.pem"
echo "      ├── cert.pem"
echo "      └── key.pem"
echo ""
warn "请将 ca-key.pem 妥善保管，不要放在服务器上！"
