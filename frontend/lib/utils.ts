import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * 验证端口号是否有效
 * @param port - 端口号
 * @returns 是否有效
 */
export function isValidPort(port: number | string): boolean {
  const portNum = typeof port === 'string' ? parseInt(port, 10) : port
  return !isNaN(portNum) && portNum >= 1 && portNum <= 65535
}

/**
 * 安全地解析端口号
 * @param value - 输入值
 * @param defaultPort - 默认端口
 * @returns 有效的端口号
 */
export function parsePort(value: string, defaultPort: number = 8080): number {
  const port = parseInt(value, 10)
  return isValidPort(port) ? port : defaultPort
}

/**
 * 验证 IPv4 地址格式
 * @param ip - IP 地址字符串
 * @returns 是否有效
 */
export function isValidIPv4(ip: string): boolean {
  if (!ip) return false

  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
  const match = ip.match(ipv4Regex)

  if (!match) return false

  // 检查每个段是否在 0-255 范围内
  for (let i = 1; i <= 4; i++) {
    const segment = parseInt(match[i], 10)
    if (segment < 0 || segment > 255) return false
  }

  return true
}

/**
 * 验证监听地址（支持 0.0.0.0, 127.0.0.1, 或有效的 IPv4）
 * @param address - 监听地址
 * @returns 是否有效
 */
export function isValidListenAddress(address: string): boolean {
  return isValidIPv4(address) || address === '::' || address === '::1'
}

/**
 * 增强的 fetch 错误处理
 * @param response - fetch 响应对象
 * @returns 解析后的错误信息
 */
export async function parseErrorResponse(response: Response): Promise<string> {
  let errorMsg = `HTTP ${response.status}: ${response.statusText}`

  try {
    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const error = await response.json()
      errorMsg = error.message || error.error || errorMsg
    } else {
      const text = await response.text()
      if (text) {
        errorMsg = text.substring(0, 200) // 限制错误信息长度
      }
    }
  } catch {
    // 如果解析失败，使用默认错误信息
  }

  return errorMsg
}

/**
 * 生成加密安全的随机字符串
 * @param length - 字符串长度
 * @param chars - 可用字符集
 * @returns 随机字符串
 */
export function generateSecureRandomString(
  length: number,
  chars: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
): string {
  if (typeof window === 'undefined' || !window.crypto) {
    // 服务端渲染或不支持 crypto API 时的降级方案
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('')
  }

  const array = new Uint8Array(length)
  window.crypto.getRandomValues(array)

  return Array.from(array, (byte) => chars[byte % chars.length]).join('')
}

/**
 * 生成 Shadowsocks 2022 协议所需的 Base64 密钥
 * @param method - 加密方法
 * @returns Base64 编码的密钥
 */
export function generateSS2022Key(method: string): string {
  // 根据加密方法确定密钥字节长度
  let keyLength: number
  if (method === "2022-blake3-aes-128-gcm") {
    keyLength = 16 // 128 位
  } else if (method === "2022-blake3-aes-256-gcm" || method === "2022-blake3-chacha20-poly1305") {
    keyLength = 32 // 256 位
  } else {
    // 非 2022 协议，返回普通密码
    return generateSecureRandomString(16)
  }

  // 生成随机字节
  const array = new Uint8Array(keyLength)
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array)
  } else {
    // 降级方案
    for (let i = 0; i < keyLength; i++) {
      array[i] = Math.floor(Math.random() * 256)
    }
  }

  // 转换为 Base64
  let binary = ''
  array.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}
