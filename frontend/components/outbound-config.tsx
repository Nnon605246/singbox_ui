"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, RefreshCw, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { useTranslation } from "@/lib/i18n"

interface ProxyNode {
  name: string
  type: string
  address: string
  port: number
  settings: Record<string, any>
  outbound: Record<string, any>
}

interface SubscriptionEntry {
  id: string
  name: string
  url: string
  nodes: ProxyNode[]
}

interface OutboundConfigProps {
  showCard?: boolean
}

export function OutboundConfig({ showCard = true }: OutboundConfigProps) {
  const { config, setOutbound, setBalancerState } = useSingboxConfigStore()
  const initialConfig = config.outbounds?.[0]
  const { toast } = useToast()
  const { t } = useTranslation("outbound")
  const { t: tc } = useTranslation("common")
  const [outboundType, setOutboundType] = useState("subscription")
  const [error, setError] = useState("")

  const isInitializedRef = useRef(false)
  const prevSelectedNodeRef = useRef<ProxyNode | null>(null)

  // 订阅节点状态
  const [subscriptions, setSubscriptions] = useState<SubscriptionEntry[]>([])
  const [loadingNodes, setLoadingNodes] = useState(true)
  const [selectedNode, setSelectedNode] = useState<ProxyNode | null>(null)

  // 负载均衡状态
  const [enableBalancer, setEnableBalancer] = useState(false)
  const [selectedNodeTags, setSelectedNodeTags] = useState<string[]>([])
  const [balancerStrategy, setBalancerStrategy] = useState<string>("50")

  // VMess 配置 (sing-box格式)
  const [vmessConfig, setVmessConfig] = useState({
    server: "",
    server_port: 443,
    uuid: "",
    alter_id: 0,
    security: "auto",
    global_padding: false,
    authenticated_length: true,
    // TLS 配置
    tls_enabled: false,
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    // uTLS 配置
    utls_enabled: false,
    utls_fingerprint: "chrome",
    // 传输层配置
    transport_type: "", // "", "ws", "grpc", "http", "httpupgrade"
    transport_path: "",
    transport_host: "",
    transport_service_name: "",
    // 其他
    packet_encoding: "",
  })

  // VLESS 配置 (sing-box格式)
  const [vlessConfig, setVlessConfig] = useState({
    server: "",
    server_port: 443,
    uuid: "",
    flow: "",
    // TLS 配置
    tls_enabled: true,
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    // uTLS 配置
    utls_enabled: false,
    utls_fingerprint: "chrome",
    // Reality 配置
    reality_enabled: false,
    reality_public_key: "",
    reality_short_id: "",
    // 传输层配置
    transport_type: "", // "", "ws", "grpc", "http", "httpupgrade"
    transport_path: "",
    transport_host: "",
    transport_service_name: "",
    // 其他
    packet_encoding: "",
  })

  // Trojan 配置 (sing-box格式)
  const [trojanConfig, setTrojanConfig] = useState({
    server: "",
    server_port: 443,
    password: "",
    // TLS 配置 (Trojan 必须启用 TLS)
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    // 传输层配置
    transport_type: "", // "", "ws", "grpc", "http", "httpupgrade"
    transport_path: "",
    transport_host: "",
    transport_service_name: "",
  })

  // Socks 配置 (sing-box格式)
  const [socksConfig, setSocksConfig] = useState({
    server: "",
    server_port: 1080,
    version: "5", // "4", "4a", "5"
    username: "",
    password: "",
  })

  // HTTP 配置 (sing-box格式)
  const [httpConfig, setHttpConfig] = useState({
    server: "",
    server_port: 8080,
    username: "",
    password: "",
    path: "",
    // TLS 配置 (用于 HTTPS 代理)
    tls_enabled: false,
    tls_server_name: "",
    tls_insecure: false,
  })

  // WireGuard 配置 (sing-box格式)
  const [wgConfig, setWgConfig] = useState({
    server: "",
    server_port: 51820,
    private_key: "",
    peer_public_key: "",
    pre_shared_key: "",
    local_address: "10.10.0.2/32",
    reserved: "", // 格式: "0,0,0" 用于 Cloudflare WARP
    mtu: 1420,
  })

  // Shadowsocks 配置 (sing-box格式)
  const [ssConfig, setSsConfig] = useState({
    server: "",
    server_port: 8388,
    method: "aes-128-gcm",
    password: "",
    // 插件配置
    plugin: "", // "", "obfs-local", "v2ray-plugin"
    plugin_opts: "",
  })

  // AnyTLS 配置 (sing-box格式)
  const [anytlsConfig, setAnytlsConfig] = useState({
    server: "",
    server_port: 443,
    password: "",
    // TLS 配置 (AnyTLS 必须启用 TLS)
    tls_server_name: "",
    tls_insecure: false,
    // 会话管理
    idle_session_check_interval: "",
    idle_session_timeout: "",
    min_idle_session: 0,
  })

  // Hysteria2 配置 (sing-box格式)
  const [hy2Config, setHy2Config] = useState({
    server: "",
    server_port: 443,
    password: "",
    up_mbps: 100,
    down_mbps: 100,
    // 混淆配置
    obfs_type: "", // "" or "salamander"
    obfs_password: "",
    // TLS 配置
    tls_server_name: "",
    tls_insecure: false,
    tls_alpn: "",
    // 网络
    network: "", // "" (all), "tcp", "udp"
  })

  // 提取传输层 Host 字段（兼容数组和字符串格式）
  function extractTransportHost(transport: any): string {
    if (!transport) return ""
    const headerHost = Array.isArray(transport.headers?.Host)
      ? transport.headers.Host[0]
      : transport.headers?.Host
    const directHost = Array.isArray(transport.host)
      ? transport.host[0]
      : transport.host
    return headerHost || directHost || ""
  }

  // 生成与后端一致的规范节点 tag
  function generateNodeTag(type: string, address: string, port: number): string {
    const safeAddress = address.replace(/\./g, '_').replace(/:/g, '_').replace(/-/g, '_')
    const typeTag = type === 'shadowsocks' ? 'ss' : type
    return `${typeTag}-${safeAddress}-${port}`
  }

  // 处理节点选择切换（多选）
  const handleNodeToggle = (nodeTag: string) => {
    setSelectedNodeTags(prev => {
      if (prev.includes(nodeTag)) {
        return prev.filter(tag => tag !== nodeTag)
      } else {
        return [...prev, nodeTag]
      }
    })
  }

  // 更新全局 store 中的负载均衡配置
  useEffect(() => {
    if (enableBalancer && selectedNodeTags.length >= 2) {
      const selectedOutbounds = subscriptions.flatMap(sub =>
        (sub.nodes || [])
          .filter(node => {
            const nodeTag = node.outbound?.tag || generateNodeTag(node.type, node.address, node.port)
            return selectedNodeTags.includes(nodeTag)
          })
          .map(node => node.outbound)
          .filter(Boolean)
      )
      setBalancerState({
        enabled: true,
        selectedOutbounds: selectedNodeTags,
        strategy: balancerStrategy,
        allOutbounds: selectedOutbounds as any
      })
    } else {
      setBalancerState(null)
    }
  }, [enableBalancer, selectedNodeTags, balancerStrategy, subscriptions, setBalancerState])

  // 从 initialConfig 初始化表单（仅在首次加载时，sing-box格式）
  useEffect(() => {
    if (isInitializedRef.current) return

    if (initialConfig && initialConfig.type) {
      setOutboundType(initialConfig.type)

      switch (initialConfig.type) {
        case "vmess":
          setVmessConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 443,
            uuid: initialConfig.uuid || "",
            alter_id: initialConfig.alter_id || 0,
            security: initialConfig.security || "auto",
            global_padding: initialConfig.global_padding || false,
            authenticated_length: initialConfig.authenticated_length ?? true,
            tls_enabled: initialConfig.tls?.enabled || false,
            tls_server_name: initialConfig.tls?.server_name || "",
            tls_insecure: initialConfig.tls?.insecure || false,
            tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
            utls_enabled: initialConfig.tls?.utls?.enabled || false,
            utls_fingerprint: initialConfig.tls?.utls?.fingerprint || "chrome",
            transport_type: initialConfig.transport?.type || "",
            transport_path: initialConfig.transport?.path || "",
            transport_host: extractTransportHost(initialConfig.transport),
            transport_service_name: initialConfig.transport?.service_name || "",
            packet_encoding: initialConfig.packet_encoding || "",
          })
          break

        case "vless":
          setVlessConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 443,
            uuid: initialConfig.uuid || "",
            flow: initialConfig.flow || "",
            tls_enabled: initialConfig.tls?.enabled ?? true,
            tls_server_name: initialConfig.tls?.server_name || "",
            tls_insecure: initialConfig.tls?.insecure || false,
            tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
            utls_enabled: initialConfig.tls?.utls?.enabled || false,
            utls_fingerprint: initialConfig.tls?.utls?.fingerprint || "chrome",
            reality_enabled: initialConfig.tls?.reality?.enabled || false,
            reality_public_key: initialConfig.tls?.reality?.public_key || "",
            reality_short_id: initialConfig.tls?.reality?.short_id || "",
            transport_type: initialConfig.transport?.type || "",
            transport_path: initialConfig.transport?.path || "",
            transport_host: extractTransportHost(initialConfig.transport),
            transport_service_name: initialConfig.transport?.service_name || "",
            packet_encoding: initialConfig.packet_encoding || "",
          })
          break

        case "trojan":
          setTrojanConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 443,
            password: initialConfig.password || "",
            tls_server_name: initialConfig.tls?.server_name || "",
            tls_insecure: initialConfig.tls?.insecure || false,
            tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
            transport_type: initialConfig.transport?.type || "",
            transport_path: initialConfig.transport?.path || "",
            transport_host: extractTransportHost(initialConfig.transport),
            transport_service_name: initialConfig.transport?.service_name || "",
          })
          break

        case "socks":
          setSocksConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 1080,
            version: initialConfig.version || "5",
            username: initialConfig.username || "",
            password: initialConfig.password || "",
          })
          break

        case "http":
          setHttpConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 8080,
            username: initialConfig.username || "",
            password: initialConfig.password || "",
            path: initialConfig.path || "",
            tls_enabled: initialConfig.tls?.enabled || false,
            tls_server_name: initialConfig.tls?.server_name || "",
            tls_insecure: initialConfig.tls?.insecure || false,
          })
          break

        case "wireguard":
          setWgConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 51820,
            private_key: initialConfig.private_key || "",
            peer_public_key: initialConfig.peer_public_key || "",
            pre_shared_key: initialConfig.pre_shared_key || "",
            local_address: initialConfig.local_address?.[0] || "10.10.0.2/32",
            reserved: Array.isArray(initialConfig.reserved) ? initialConfig.reserved.join(",") : "",
            mtu: initialConfig.mtu || 1420,
          })
          break

        case "shadowsocks":
          setSsConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 8388,
            method: initialConfig.method || "aes-128-gcm",
            password: initialConfig.password || "",
            plugin: initialConfig.plugin || "",
            plugin_opts: initialConfig.plugin_opts || "",
          })
          break

        case "hysteria2":
          setHy2Config({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 443,
            password: initialConfig.password || "",
            up_mbps: initialConfig.up_mbps || 100,
            down_mbps: initialConfig.down_mbps || 100,
            obfs_type: initialConfig.obfs?.type || "",
            obfs_password: initialConfig.obfs?.password || "",
            tls_server_name: initialConfig.tls?.server_name || "",
            tls_insecure: initialConfig.tls?.insecure || false,
            tls_alpn: Array.isArray(initialConfig.tls?.alpn) ? initialConfig.tls.alpn.join(",") : "",
            network: Array.isArray(initialConfig.network) ? initialConfig.network[0] : (initialConfig.network || ""),
          })
          break

        case "anytls":
          setAnytlsConfig({
            server: initialConfig.server || "",
            server_port: initialConfig.server_port || 443,
            password: initialConfig.password || "",
            tls_server_name: initialConfig.tls?.server_name || "",
            tls_insecure: initialConfig.tls?.insecure || false,
            idle_session_check_interval: String(initialConfig.idle_session_check_interval || ""),
            idle_session_timeout: String(initialConfig.idle_session_timeout || ""),
            min_idle_session: Number(initialConfig.min_idle_session) || 0,
          })
          break
      }
    }
    isInitializedRef.current = true
  }, [initialConfig])

  // 加载订阅节点
  useEffect(() => {
    const loadNodes = async () => {
      try {
        const response = await fetch("/api/subscription")
        if (response.ok) {
          const data = await response.json()
          setSubscriptions(data.subscriptions || [])
        }
      } catch (error) {
        console.log("Failed to load subscriptions")
      } finally {
        setLoadingNodes(false)
      }
    }
    loadNodes()
  }, [])

  // 刷新订阅节点
  const refreshNodes = async () => {
    setLoadingNodes(true)
    try {
      const response = await fetch("/api/subscription/refresh-all", {
        method: "POST",
      })
      if (response.ok) {
        const data = await response.json()
        setSubscriptions(data.subscriptions || [])
        toast({
          title: tc("success"),
          description: t("refreshSuccessDesc", { count: data.totalNodes }),
        })
      }
    } catch (error) {
      toast({
        title: t("refreshFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setLoadingNodes(false)
    }
  }

  // 选择订阅节点（单选模式，统一使用 proxy_out 标签）
  const handleSelectNode = (node: ProxyNode) => {
    setSelectedNode(node)
    if (node.outbound) {
      const outboundWithProxyTag = {
        ...node.outbound,
        tag: "proxy_out"
      } as any
      setOutbound(0, outboundWithProxyTag)
    }
    const nodeName = String(node.name || 'Unknown')
    toast({
      title: t("nodeSelectedTitle"),
      description: t("nodeSelected", { name: nodeName }),
    })
  }

  // 实时生成预览配置（sing-box格式）
  useEffect(() => {
    if (!isInitializedRef.current) return

    // 如果是订阅模式，使用选中的节点配置
    if (outboundType === "subscription") {
      if (selectedNode?.outbound && selectedNode !== prevSelectedNodeRef.current) {
        const outboundWithProxyTag = {
          ...selectedNode.outbound,
          tag: "proxy_out"
        } as any
        setOutbound(0, outboundWithProxyTag)
        prevSelectedNodeRef.current = selectedNode
      }
      return
    }

    let previewConfig: any = {}

    switch (outboundType) {
      case "direct":
        previewConfig = {
          type: "direct",
          tag: "direct",
        }
        break

      case "block":
        previewConfig = {
          type: "block",
          tag: "block",
        }
        break

      case "vmess":
        if (vmessConfig.server && vmessConfig.uuid) {
          previewConfig = {
            type: "vmess",
            tag: "proxy_out",
            server: vmessConfig.server,
            server_port: vmessConfig.server_port,
            uuid: vmessConfig.uuid,
            security: vmessConfig.security,
            alter_id: vmessConfig.alter_id,
          }
          if (vmessConfig.global_padding) {
            previewConfig.global_padding = true
          }
          if (vmessConfig.authenticated_length) {
            previewConfig.authenticated_length = true
          }
          if (vmessConfig.packet_encoding) {
            previewConfig.packet_encoding = vmessConfig.packet_encoding
          }
          // TLS 配置
          if (vmessConfig.tls_enabled) {
            const tlsConfig: any = { enabled: true }
            if (vmessConfig.tls_server_name) {
              tlsConfig.server_name = vmessConfig.tls_server_name
            }
            if (vmessConfig.tls_insecure) {
              tlsConfig.insecure = true
            }
            if (vmessConfig.tls_alpn) {
              tlsConfig.alpn = vmessConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
            }
            // uTLS 配置
            if (vmessConfig.utls_enabled) {
              tlsConfig.utls = {
                enabled: true,
                fingerprint: vmessConfig.utls_fingerprint,
              }
            }
            previewConfig.tls = tlsConfig
          }
          // 传输层配置
          if (vmessConfig.transport_type) {
            const transportConfig: any = { type: vmessConfig.transport_type }
            if (vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") {
              if (vmessConfig.transport_path) {
                transportConfig.path = vmessConfig.transport_path
              }
              if (vmessConfig.transport_host) {
                if (vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "httpupgrade") {
                  transportConfig.headers = { Host: vmessConfig.transport_host }
                } else {
                  transportConfig.host = [vmessConfig.transport_host]
                }
              }
            } else if (vmessConfig.transport_type === "grpc") {
              if (vmessConfig.transport_service_name) {
                transportConfig.service_name = vmessConfig.transport_service_name
              }
            }
            previewConfig.transport = transportConfig
          }
        }
        break

      case "vless":
        if (vlessConfig.server && vlessConfig.uuid) {
          previewConfig = {
            type: "vless",
            tag: "proxy_out",
            server: vlessConfig.server,
            server_port: vlessConfig.server_port,
            uuid: vlessConfig.uuid,
          }
          if (vlessConfig.flow) {
            previewConfig.flow = vlessConfig.flow
          }
          if (vlessConfig.packet_encoding) {
            previewConfig.packet_encoding = vlessConfig.packet_encoding
          }
          // TLS 配置
          if (vlessConfig.tls_enabled) {
            const tlsConfig: any = { enabled: true }
            if (vlessConfig.tls_server_name) {
              tlsConfig.server_name = vlessConfig.tls_server_name
            }
            if (vlessConfig.tls_insecure) {
              tlsConfig.insecure = true
            }
            if (vlessConfig.tls_alpn) {
              tlsConfig.alpn = vlessConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
            }
            // Reality 配置（Reality 必须启用 uTLS）
            if (vlessConfig.reality_enabled) {
              tlsConfig.utls = {
                enabled: true,
                fingerprint: vlessConfig.utls_fingerprint,
              }
              tlsConfig.reality = {
                enabled: true,
                public_key: vlessConfig.reality_public_key,
                short_id: vlessConfig.reality_short_id,
              }
            } else if (vlessConfig.utls_enabled) {
              // 非 Reality 模式下，uTLS 可选
              tlsConfig.utls = {
                enabled: true,
                fingerprint: vlessConfig.utls_fingerprint,
              }
            }
            previewConfig.tls = tlsConfig
          }
          // 传输层配置
          if (vlessConfig.transport_type) {
            const transportConfig: any = { type: vlessConfig.transport_type }
            if (vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "http" || vlessConfig.transport_type === "httpupgrade") {
              if (vlessConfig.transport_path) {
                transportConfig.path = vlessConfig.transport_path
              }
              if (vlessConfig.transport_host) {
                if (vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "httpupgrade") {
                  transportConfig.headers = { Host: vlessConfig.transport_host }
                } else {
                  transportConfig.host = [vlessConfig.transport_host]
                }
              }
            } else if (vlessConfig.transport_type === "grpc") {
              if (vlessConfig.transport_service_name) {
                transportConfig.service_name = vlessConfig.transport_service_name
              }
            }
            previewConfig.transport = transportConfig
          }
        }
        break

      case "trojan":
        if (trojanConfig.server && trojanConfig.password) {
          previewConfig = {
            type: "trojan",
            tag: "proxy_out",
            server: trojanConfig.server,
            server_port: trojanConfig.server_port,
            password: trojanConfig.password,
          }
          // TLS 配置 (Trojan 必须启用 TLS)
          const trojanTlsConfig: any = { enabled: true }
          if (trojanConfig.tls_server_name) {
            trojanTlsConfig.server_name = trojanConfig.tls_server_name
          }
          if (trojanConfig.tls_insecure) {
            trojanTlsConfig.insecure = true
          }
          if (trojanConfig.tls_alpn) {
            trojanTlsConfig.alpn = trojanConfig.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
          }
          previewConfig.tls = trojanTlsConfig
          // 传输层配置
          if (trojanConfig.transport_type) {
            const transportConfig: any = { type: trojanConfig.transport_type }
            if (trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") {
              if (trojanConfig.transport_path) {
                transportConfig.path = trojanConfig.transport_path
              }
              if (trojanConfig.transport_host) {
                if (trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "httpupgrade") {
                  transportConfig.headers = { Host: trojanConfig.transport_host }
                } else {
                  transportConfig.host = [trojanConfig.transport_host]
                }
              }
            } else if (trojanConfig.transport_type === "grpc") {
              if (trojanConfig.transport_service_name) {
                transportConfig.service_name = trojanConfig.transport_service_name
              }
            }
            previewConfig.transport = transportConfig
          }
        }
        break

      case "socks":
        if (socksConfig.server) {
          previewConfig = {
            type: "socks",
            tag: "proxy_out",
            server: socksConfig.server,
            server_port: socksConfig.server_port,
          }
          if (socksConfig.version && socksConfig.version !== "5") {
            previewConfig.version = socksConfig.version
          }
          if (socksConfig.username && socksConfig.password) {
            previewConfig.username = socksConfig.username
            previewConfig.password = socksConfig.password
          }
        }
        break

      case "http":
        if (httpConfig.server) {
          previewConfig = {
            type: "http",
            tag: "proxy_out",
            server: httpConfig.server,
            server_port: httpConfig.server_port,
          }
          if (httpConfig.username && httpConfig.password) {
            previewConfig.username = httpConfig.username
            previewConfig.password = httpConfig.password
          }
          if (httpConfig.path) {
            previewConfig.path = httpConfig.path
          }
          // TLS 配置
          if (httpConfig.tls_enabled) {
            const httpTlsConfig: any = { enabled: true }
            if (httpConfig.tls_server_name) {
              httpTlsConfig.server_name = httpConfig.tls_server_name
            }
            if (httpConfig.tls_insecure) {
              httpTlsConfig.insecure = true
            }
            previewConfig.tls = httpTlsConfig
          }
        }
        break

      case "wireguard":
        if (wgConfig.private_key && wgConfig.peer_public_key && wgConfig.server) {
          previewConfig = {
            type: "wireguard",
            tag: "proxy_out",
            server: wgConfig.server,
            server_port: wgConfig.server_port,
            private_key: wgConfig.private_key,
            peer_public_key: wgConfig.peer_public_key,
            local_address: [wgConfig.local_address],
            mtu: wgConfig.mtu,
          }
          if (wgConfig.pre_shared_key) {
            previewConfig.pre_shared_key = wgConfig.pre_shared_key
          }
          if (wgConfig.reserved) {
            const reservedArr = wgConfig.reserved.split(",").map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n))
            if (reservedArr.length === 3) {
              previewConfig.reserved = reservedArr
            }
          }
        }
        break

      case "shadowsocks":
        if (ssConfig.server && ssConfig.password) {
          previewConfig = {
            type: "shadowsocks",
            tag: "proxy_out",
            server: ssConfig.server,
            server_port: ssConfig.server_port,
            method: ssConfig.method,
            password: ssConfig.password,
          }
          if (ssConfig.plugin) {
            previewConfig.plugin = ssConfig.plugin
            if (ssConfig.plugin_opts) {
              previewConfig.plugin_opts = ssConfig.plugin_opts
            }
          }
        }
        break

      case "hysteria2":
        if (hy2Config.server && hy2Config.password) {
          previewConfig = {
            type: "hysteria2",
            tag: "proxy_out",
            server: hy2Config.server,
            server_port: hy2Config.server_port,
            password: hy2Config.password,
          }
          if (hy2Config.up_mbps) {
            previewConfig.up_mbps = hy2Config.up_mbps
          }
          if (hy2Config.down_mbps) {
            previewConfig.down_mbps = hy2Config.down_mbps
          }
          if (hy2Config.network) {
            previewConfig.network = hy2Config.network
          }
          // 混淆配置
          if (hy2Config.obfs_type === "salamander" && hy2Config.obfs_password) {
            previewConfig.obfs = {
              type: "salamander",
              password: hy2Config.obfs_password,
            }
          }
          // TLS 配置 (Hysteria2 必须启用 TLS)
          const tlsConfig: any = { enabled: true }
          if (hy2Config.tls_server_name) {
            tlsConfig.server_name = hy2Config.tls_server_name
          }
          if (hy2Config.tls_insecure) {
            tlsConfig.insecure = true
          }
          if (hy2Config.tls_alpn) {
            tlsConfig.alpn = hy2Config.tls_alpn.split(",").map((s: string) => s.trim()).filter(Boolean)
          }
          previewConfig.tls = tlsConfig
        }
        break

      case "anytls":
        if (anytlsConfig.server && anytlsConfig.password) {
          previewConfig = {
            type: "anytls",
            tag: "proxy_out",
            server: anytlsConfig.server,
            server_port: anytlsConfig.server_port,
            password: anytlsConfig.password,
          }
          // TLS 配置 (AnyTLS 必须启用 TLS)
          const anytlsTlsConfig: any = { enabled: true }
          if (anytlsConfig.tls_server_name) {
            anytlsTlsConfig.server_name = anytlsConfig.tls_server_name
          }
          if (anytlsConfig.tls_insecure) {
            anytlsTlsConfig.insecure = true
          }
          previewConfig.tls = anytlsTlsConfig
          // 会话管理
          if (anytlsConfig.idle_session_check_interval) {
            previewConfig.idle_session_check_interval = anytlsConfig.idle_session_check_interval
          }
          if (anytlsConfig.idle_session_timeout) {
            previewConfig.idle_session_timeout = anytlsConfig.idle_session_timeout
          }
          if (anytlsConfig.min_idle_session > 0) {
            previewConfig.min_idle_session = anytlsConfig.min_idle_session
          }
        }
        break
    }

    if (Object.keys(previewConfig).length > 0) {
      setOutbound(0, previewConfig)
    }
  }, [outboundType, vmessConfig, vlessConfig, trojanConfig, socksConfig, httpConfig, wgConfig, ssConfig, hy2Config, anytlsConfig, selectedNode, setOutbound])

  const totalNodes = subscriptions.reduce((sum, sub) => sum + (sub.nodes?.length || 0), 0)

  const content = (
    <div className="space-y-4">
          <Tabs value={outboundType} onValueChange={setOutboundType} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="subscription">{t("subscription")}</TabsTrigger>
              <TabsTrigger value="direct">{t("direct")}</TabsTrigger>
              <TabsTrigger value="vless">VLESS</TabsTrigger>
              <TabsTrigger value="vmess">VMess</TabsTrigger>
              <TabsTrigger value="trojan">Trojan</TabsTrigger>
            </TabsList>
            <TabsList className="grid w-full grid-cols-7 mt-2">
              <TabsTrigger value="shadowsocks">Shadowsocks</TabsTrigger>
              <TabsTrigger value="hysteria2">Hysteria2</TabsTrigger>
              <TabsTrigger value="anytls">AnyTLS</TabsTrigger>
              <TabsTrigger value="wireguard">WireGuard</TabsTrigger>
              <TabsTrigger value="socks">Socks</TabsTrigger>
              <TabsTrigger value="http">HTTP</TabsTrigger>
              <TabsTrigger value="block">{t("block")}</TabsTrigger>
            </TabsList>

            {/* 订阅节点选择 */}
            <TabsContent value="subscription" className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {t("summaryText", { subCount: subscriptions.length, nodeCount: totalNodes })}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={refreshNodes}
                    disabled={loadingNodes}
                    variant="outline"
                    size="sm"
                  >
                    {loadingNodes ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-1" />
                    )}
                    {tc("refresh")}
                  </Button>
                </div>
              </div>

              {/* 负载均衡开关 */}
              {totalNodes > 0 && (
                <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
                  <Checkbox
                    id="enable-balancer"
                    checked={enableBalancer}
                    onCheckedChange={(checked) => {
                      setEnableBalancer(checked as boolean)
                      if (!checked) {
                        setSelectedNodeTags([])
                      }
                    }}
                  />
                  <Label htmlFor="enable-balancer" className="text-sm font-medium cursor-pointer">
                    {t("enableBalancerMultiSelect")}
                  </Label>
                  {enableBalancer && selectedNodeTags.length < 2 && (
                    <span className="text-xs text-destructive">{t("minTwoNodes")}</span>
                  )}
                  {enableBalancer && selectedNodeTags.length >= 2 && (
                    <span className="text-xs text-green-600">{t("selectedCount", { count: selectedNodeTags.length })}</span>
                  )}
                </div>
              )}

              {/* urltest 参数设置 */}
              {enableBalancer && (
                <div className="space-y-2">
                  <Label>{t("tolerance")}</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={5000}
                      value={balancerStrategy}
                      onChange={(e) => setBalancerStrategy(e.target.value)}
                      className="w-[120px]"
                      placeholder="50"
                    />
                    <span className="text-sm text-muted-foreground">ms</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("toleranceDesc")}
                  </p>
                </div>
              )}

              {loadingNodes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">{tc("loading")}</span>
                </div>
              ) : subscriptions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>{t("noSubscriptionNodes")}</p>
                  <p className="text-sm mt-1">{t("noSubscriptionNodesHint")}</p>
                </div>
              ) : (
                <div className="border rounded-lg max-h-[400px] overflow-auto">
                  {subscriptions.map((sub) => (
                    <div key={sub.id}>
                      <div className="px-3 py-2 bg-muted/50 font-medium text-sm border-b">
                        {sub.name} ({sub.nodes?.length || 0})
                      </div>
                      {sub.nodes?.map((node, index) => {
                        const nodeType = String(node.type || 'unknown')
                        const address = String(node.address || '')
                        const port = Number(node.port) || 0
                        const name = String(node.name || '')
                        const nodeTag = node.outbound?.tag || generateNodeTag(nodeType, address, port)
                        const isChecked = selectedNodeTags.includes(nodeTag)
                        return (
                          <div
                            key={index}
                            className={`p-2 px-4 border-b last:border-b-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                              enableBalancer
                                ? isChecked ? "bg-primary/10" : ""
                                : selectedNode === node ? "bg-primary/10" : ""
                            }`}
                            onClick={() => {
                              if (enableBalancer) {
                                handleNodeToggle(nodeTag)
                              } else {
                                handleSelectNode(node)
                              }
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {enableBalancer ? (
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => handleNodeToggle(nodeTag)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  selectedNode === node && (
                                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                  )
                                )}
                                <span className="truncate text-sm">{name || `${t("node")} ${index + 1}`}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">
                                  {nodeType.toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {address}:{port}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Direct 配置 */}
            <TabsContent value="direct" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {t("directDesc")}
              </div>
            </TabsContent>

            {/* Block 配置 */}
            <TabsContent value="block" className="space-y-4">
              <div className="text-sm text-muted-foreground">
                {t("blockDesc")}
              </div>
            </TabsContent>

            {/* AnyTLS 配置 */}
            <TabsContent value="anytls" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={anytlsConfig.server}
                    onChange={(e) => setAnytlsConfig({ ...anytlsConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={anytlsConfig.server_port}
                    onChange={(e) => setAnytlsConfig({ ...anytlsConfig, server_port: parseInt(e.target.value) || 443 })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tc("password")}</Label>
                <Input
                  placeholder="password"
                  value={anytlsConfig.password}
                  onChange={(e) => setAnytlsConfig({ ...anytlsConfig, password: e.target.value })}
                />
              </div>

              {/* TLS 配置 */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="text-sm font-medium">{t("tlsRequired")}</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("serverName")}</Label>
                    <Input
                      placeholder="example.com"
                      value={anytlsConfig.tls_server_name}
                      onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_server_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2 flex items-end">
                    <label className="flex items-center gap-2 text-sm pb-2">
                      <input
                        type="checkbox"
                        checked={anytlsConfig.tls_insecure}
                        onChange={(e) => setAnytlsConfig({ ...anytlsConfig, tls_insecure: e.target.checked })}
                        className="h-4 w-4"
                      />
                      {t("insecure")}
                    </label>
                  </div>
                </div>
              </div>

              {/* 会话管理 */}
              <div className="border-t pt-4 mt-4 space-y-4">
                <div className="text-sm font-medium">{t("sessionManagement")}</div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>{t("idleCheckInterval")}</Label>
                    <Input
                      placeholder="30s"
                      value={anytlsConfig.idle_session_check_interval}
                      onChange={(e) => setAnytlsConfig({ ...anytlsConfig, idle_session_check_interval: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("idleTimeout")}</Label>
                    <Input
                      placeholder="30s"
                      value={anytlsConfig.idle_session_timeout}
                      onChange={(e) => setAnytlsConfig({ ...anytlsConfig, idle_session_timeout: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("minIdleSessions")}</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={anytlsConfig.min_idle_session}
                      onChange={(e) => setAnytlsConfig({ ...anytlsConfig, min_idle_session: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* VMess 配置 */}
            <TabsContent value="vmess" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={vmessConfig.server}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={vmessConfig.server_port}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>UUID</Label>
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={vmessConfig.uuid}
                  onChange={(e) => setVmessConfig({ ...vmessConfig, uuid: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Alter ID</Label>
                  <Input
                    type="number"
                    value={vmessConfig.alter_id}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, alter_id: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("security")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vmessConfig.security}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, security: e.target.value })}
                  >
                    <option value="auto">auto</option>
                    <option value="aes-128-gcm">aes-128-gcm</option>
                    <option value="chacha20-poly1305">chacha20-poly1305</option>
                    <option value="none">none</option>
                    <option value="zero">zero</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("packetEncoding")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vmessConfig.packet_encoding}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, packet_encoding: e.target.value })}
                  >
                    <option value="">{tc("disabled")}</option>
                    <option value="xudp">xudp</option>
                    <option value="packetaddr">packetaddr</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm pt-8">
                  <input
                    type="checkbox"
                    checked={vmessConfig.global_padding}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, global_padding: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Global Padding
                </label>
                <label className="flex items-center gap-2 text-sm pt-8">
                  <input
                    type="checkbox"
                    checked={vmessConfig.authenticated_length}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, authenticated_length: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Authenticated Length
                </label>
              </div>

              {/* TLS 配置 */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="font-semibold">{t("tlsSettings")}</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={vmessConfig.tls_enabled}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, tls_enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("enableTls")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={vmessConfig.tls_insecure}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, tls_insecure: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("insecure")}
                  </label>
                </div>
                {vmessConfig.tls_enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("sniServerName")}</Label>
                      <Input
                        placeholder={t("sniPlaceholder")}
                        value={vmessConfig.tls_server_name}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, tls_server_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ALPN</Label>
                      <Input
                        placeholder="h2,http/1.1"
                        value={vmessConfig.tls_alpn}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, tls_alpn: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* uTLS 配置 */}
              {vmessConfig.tls_enabled && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={vmessConfig.utls_enabled}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, utls_enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {t("enableUtls")}
                    </label>
                  </div>
                  {vmessConfig.utls_enabled && (
                    <div className="space-y-2">
                      <Label>{t("browserFingerprint")}</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={vmessConfig.utls_fingerprint}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, utls_fingerprint: e.target.value })}
                      >
                        <option value="chrome">Chrome</option>
                        <option value="firefox">Firefox</option>
                        <option value="safari">Safari</option>
                        <option value="edge">Edge</option>
                        <option value="ios">iOS</option>
                        <option value="android">Android</option>
                        <option value="random">{t("random")}</option>
                        <option value="randomized">{t("randomized")}</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* 传输层配置 */}
              <div className="border-t pt-4">
                <div className="space-y-2 mb-4">
                  <Label className="font-semibold">{t("transport")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vmessConfig.transport_type}
                    onChange={(e) => setVmessConfig({ ...vmessConfig, transport_type: e.target.value })}
                  >
                    <option value="">{t("tcpDefault")}</option>
                    <option value="ws">WebSocket</option>
                    <option value="grpc">gRPC</option>
                    <option value="http">HTTP/2</option>
                    <option value="httpupgrade">HTTPUpgrade</option>
                  </select>
                </div>
                {(vmessConfig.transport_type === "ws" || vmessConfig.transport_type === "http" || vmessConfig.transport_type === "httpupgrade") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("path")}</Label>
                      <Input
                        placeholder="/"
                        value={vmessConfig.transport_path}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, transport_path: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Host</Label>
                      <Input
                        placeholder="example.com"
                        value={vmessConfig.transport_host}
                        onChange={(e) => setVmessConfig({ ...vmessConfig, transport_host: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {vmessConfig.transport_type === "grpc" && (
                  <div className="space-y-2">
                    <Label>{t("serviceName")}</Label>
                    <Input
                      placeholder="grpc_service"
                      value={vmessConfig.transport_service_name}
                      onChange={(e) => setVmessConfig({ ...vmessConfig, transport_service_name: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* VLESS 配置 */}
            <TabsContent value="vless" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={vlessConfig.server}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={vlessConfig.server_port}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>UUID</Label>
                <Input
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  value={vlessConfig.uuid}
                  onChange={(e) => setVlessConfig({ ...vlessConfig, uuid: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("flow")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vlessConfig.flow}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, flow: e.target.value })}
                  >
                    <option value="">{t("noneDefault")}</option>
                    <option value="xtls-rprx-vision">{t("xtlsVisionRecommended")}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t("packetEncoding")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vlessConfig.packet_encoding}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, packet_encoding: e.target.value })}
                  >
                    <option value="">{t("xudpDefault")}</option>
                    <option value="packetaddr">packetaddr</option>
                    <option value="">{tc("disabled")}</option>
                  </select>
                </div>
              </div>

              {/* TLS 配置 */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="font-semibold">{t("tlsSettings")}</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={vlessConfig.tls_enabled}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, tls_enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("enableTls")}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={vlessConfig.tls_insecure}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, tls_insecure: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("insecure")}
                  </label>
                </div>
                {vlessConfig.tls_enabled && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("sniServerName")}</Label>
                      <Input
                        placeholder={t("sniPlaceholder")}
                        value={vlessConfig.tls_server_name}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, tls_server_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>ALPN</Label>
                      <Input
                        placeholder="h2,http/1.1"
                        value={vlessConfig.tls_alpn}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, tls_alpn: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* uTLS 配置 */}
              {vlessConfig.tls_enabled && !vlessConfig.reality_enabled && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={vlessConfig.utls_enabled}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, utls_enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {t("enableUtls")}
                    </label>
                  </div>
                  {vlessConfig.utls_enabled && (
                    <div className="space-y-2">
                      <Label>{t("browserFingerprint")}</Label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={vlessConfig.utls_fingerprint}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, utls_fingerprint: e.target.value })}
                      >
                        <option value="chrome">Chrome</option>
                        <option value="firefox">Firefox</option>
                        <option value="safari">Safari</option>
                        <option value="edge">Edge</option>
                        <option value="ios">iOS</option>
                        <option value="android">Android</option>
                        <option value="random">{t("random")}</option>
                        <option value="randomized">{t("randomized")}</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {/* Reality 配置 */}
              {vlessConfig.tls_enabled && (
                <div className="border-t pt-4">
                  <div className="flex items-center gap-4 mb-4">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={vlessConfig.reality_enabled}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, reality_enabled: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {t("enableReality")}
                    </label>
                  </div>
                  {vlessConfig.reality_enabled && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>{t("utlsFingerprintRequired")}</Label>
                        <select
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={vlessConfig.utls_fingerprint}
                          onChange={(e) => setVlessConfig({ ...vlessConfig, utls_fingerprint: e.target.value })}
                        >
                          <option value="chrome">Chrome</option>
                          <option value="firefox">Firefox</option>
                          <option value="safari">Safari</option>
                          <option value="edge">Edge</option>
                          <option value="ios">iOS</option>
                          <option value="android">Android</option>
                          <option value="random">{t("random")}</option>
                          <option value="randomized">{t("randomized")}</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{t("realityPublicKey")}</Label>
                          <Input
                            placeholder={t("serverPublicKeyPlaceholder")}
                            value={vlessConfig.reality_public_key}
                            onChange={(e) => setVlessConfig({ ...vlessConfig, reality_public_key: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Short ID</Label>
                          <Input
                            placeholder="0123456789abcdef"
                            value={vlessConfig.reality_short_id}
                            onChange={(e) => setVlessConfig({ ...vlessConfig, reality_short_id: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 传输层配置 */}
              <div className="border-t pt-4">
                <div className="space-y-2 mb-4">
                  <Label className="font-semibold">{t("transport")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={vlessConfig.transport_type}
                    onChange={(e) => setVlessConfig({ ...vlessConfig, transport_type: e.target.value })}
                  >
                    <option value="">{t("tcpDefault")}</option>
                    <option value="ws">WebSocket</option>
                    <option value="grpc">gRPC</option>
                    <option value="http">HTTP/2</option>
                    <option value="httpupgrade">HTTPUpgrade</option>
                  </select>
                </div>
                {(vlessConfig.transport_type === "ws" || vlessConfig.transport_type === "http" || vlessConfig.transport_type === "httpupgrade") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("path")}</Label>
                      <Input
                        placeholder="/"
                        value={vlessConfig.transport_path}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, transport_path: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Host</Label>
                      <Input
                        placeholder="example.com"
                        value={vlessConfig.transport_host}
                        onChange={(e) => setVlessConfig({ ...vlessConfig, transport_host: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {vlessConfig.transport_type === "grpc" && (
                  <div className="space-y-2">
                    <Label>{t("serviceName")}</Label>
                    <Input
                      placeholder="grpc_service"
                      value={vlessConfig.transport_service_name}
                      onChange={(e) => setVlessConfig({ ...vlessConfig, transport_service_name: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Trojan 配置 */}
            <TabsContent value="trojan" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={trojanConfig.server}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={trojanConfig.server_port}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tc("password")}</Label>
                <Input
                  type="password"
                  value={trojanConfig.password}
                  onChange={(e) => setTrojanConfig({ ...trojanConfig, password: e.target.value })}
                />
              </div>

              {/* TLS 配置 (Trojan 必须启用 TLS) */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="font-semibold">{t("tlsSettings")}</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={trojanConfig.tls_insecure}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_insecure: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("insecure")}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("sniServerName")}</Label>
                    <Input
                      placeholder={t("sniPlaceholder")}
                      value={trojanConfig.tls_server_name}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_server_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ALPN</Label>
                    <Input
                      placeholder="h2,http/1.1"
                      value={trojanConfig.tls_alpn}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, tls_alpn: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* 传输层配置 */}
              <div className="border-t pt-4">
                <div className="space-y-2 mb-4">
                  <Label className="font-semibold">{t("transport")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={trojanConfig.transport_type}
                    onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_type: e.target.value })}
                  >
                    <option value="">{t("tcpDefault")}</option>
                    <option value="ws">WebSocket</option>
                    <option value="grpc">gRPC</option>
                    <option value="http">HTTP/2</option>
                    <option value="httpupgrade">HTTPUpgrade</option>
                  </select>
                </div>
                {(trojanConfig.transport_type === "ws" || trojanConfig.transport_type === "http" || trojanConfig.transport_type === "httpupgrade") && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t("path")}</Label>
                      <Input
                        placeholder="/"
                        value={trojanConfig.transport_path}
                        onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_path: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Host</Label>
                      <Input
                        placeholder="example.com"
                        value={trojanConfig.transport_host}
                        onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_host: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                {trojanConfig.transport_type === "grpc" && (
                  <div className="space-y-2">
                    <Label>{t("serviceName")}</Label>
                    <Input
                      placeholder="grpc_service"
                      value={trojanConfig.transport_service_name}
                      onChange={(e) => setTrojanConfig({ ...trojanConfig, transport_service_name: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Socks 配置 */}
            <TabsContent value="socks" className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="127.0.0.1"
                    value={socksConfig.server}
                    onChange={(e) => setSocksConfig({ ...socksConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={socksConfig.server_port}
                    onChange={(e) => setSocksConfig({ ...socksConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("socksVersion")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={socksConfig.version}
                    onChange={(e) => setSocksConfig({ ...socksConfig, version: e.target.value })}
                  >
                    <option value="5">{t("socks5Default")}</option>
                    <option value="4a">SOCKS4a</option>
                    <option value="4">SOCKS4</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("usernameOptional")}</Label>
                  <Input
                    value={socksConfig.username}
                    onChange={(e) => setSocksConfig({ ...socksConfig, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("passwordOptional")}</Label>
                  <Input
                    type="password"
                    value={socksConfig.password}
                    onChange={(e) => setSocksConfig({ ...socksConfig, password: e.target.value })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* HTTP 配置 */}
            <TabsContent value="http" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="127.0.0.1"
                    value={httpConfig.server}
                    onChange={(e) => setHttpConfig({ ...httpConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={httpConfig.server_port}
                    onChange={(e) => setHttpConfig({ ...httpConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("usernameOptional")}</Label>
                  <Input
                    value={httpConfig.username}
                    onChange={(e) => setHttpConfig({ ...httpConfig, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("passwordOptional")}</Label>
                  <Input
                    type="password"
                    value={httpConfig.password}
                    onChange={(e) => setHttpConfig({ ...httpConfig, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("requestPathOptional")}</Label>
                <Input
                  placeholder="/"
                  value={httpConfig.path}
                  onChange={(e) => setHttpConfig({ ...httpConfig, path: e.target.value })}
                />
              </div>

              {/* TLS 配置 (用于 HTTPS 代理) */}
              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="font-semibold">{t("tlsSettings")}</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={httpConfig.tls_enabled}
                      onChange={(e) => setHttpConfig({ ...httpConfig, tls_enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("enableTlsHttps")}
                  </label>
                  {httpConfig.tls_enabled && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={httpConfig.tls_insecure}
                        onChange={(e) => setHttpConfig({ ...httpConfig, tls_insecure: e.target.checked })}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      {t("insecure")}
                    </label>
                  )}
                </div>
                {httpConfig.tls_enabled && (
                  <div className="space-y-2">
                    <Label>{t("sniServerName")}</Label>
                    <Input
                      placeholder={t("sniPlaceholder")}
                      value={httpConfig.tls_server_name}
                      onChange={(e) => setHttpConfig({ ...httpConfig, tls_server_name: e.target.value })}
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Shadowsocks 配置 */}
            <TabsContent value="shadowsocks" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={ssConfig.server}
                    onChange={(e) => setSsConfig({ ...ssConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={ssConfig.server_port}
                    onChange={(e) => setSsConfig({ ...ssConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("security")}</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={ssConfig.method}
                  onChange={(e) => setSsConfig({ ...ssConfig, method: e.target.value })}
                >
                  <option value="aes-128-gcm">aes-128-gcm</option>
                  <option value="aes-256-gcm">aes-256-gcm</option>
                  <option value="chacha20-poly1305">chacha20-poly1305</option>
                  <option value="chacha20-ietf-poly1305">chacha20-ietf-poly1305</option>
                  <option value="xchacha20-ietf-poly1305">xchacha20-ietf-poly1305</option>
                  <option value="2022-blake3-aes-128-gcm">2022-blake3-aes-128-gcm</option>
                  <option value="2022-blake3-aes-256-gcm">2022-blake3-aes-256-gcm</option>
                  <option value="2022-blake3-chacha20-poly1305">2022-blake3-chacha20-poly1305</option>
                  <option value="none">none</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>{tc("password")}</Label>
                <Input
                  type="text"
                  value={ssConfig.password}
                  onChange={(e) => setSsConfig({ ...ssConfig, password: e.target.value })}
                />
              </div>

              {/* 插件配置 */}
              <div className="border-t pt-4 mt-4">
                <div className="space-y-2 mb-4">
                  <Label className="font-semibold">{t("sip003Plugin")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={ssConfig.plugin}
                    onChange={(e) => setSsConfig({ ...ssConfig, plugin: e.target.value })}
                  >
                    <option value="">{tc("none")}</option>
                    <option value="obfs-local">obfs-local</option>
                    <option value="v2ray-plugin">v2ray-plugin</option>
                  </select>
                </div>
                {ssConfig.plugin && (
                  <div className="space-y-2">
                    <Label>{t("pluginOpts")}</Label>
                    <Input
                      placeholder="obfs=http;obfs-host=example.com"
                      value={ssConfig.plugin_opts}
                      onChange={(e) => setSsConfig({ ...ssConfig, plugin_opts: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      {ssConfig.plugin === "obfs-local" && t("obfsExample")}
                      {ssConfig.plugin === "v2ray-plugin" && t("v2rayPluginExample")}
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Hysteria2 配置 */}
            <TabsContent value="hysteria2" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={hy2Config.server}
                    onChange={(e) => setHy2Config({ ...hy2Config, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={hy2Config.server_port}
                    onChange={(e) => setHy2Config({ ...hy2Config, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{tc("password")}</Label>
                <Input
                  type="password"
                  value={hy2Config.password}
                  onChange={(e) => setHy2Config({ ...hy2Config, password: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("upBandwidth")}</Label>
                  <Input
                    type="number"
                    value={hy2Config.up_mbps}
                    onChange={(e) => setHy2Config({ ...hy2Config, up_mbps: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("downBandwidth")}</Label>
                  <Input
                    type="number"
                    value={hy2Config.down_mbps}
                    onChange={(e) => setHy2Config({ ...hy2Config, down_mbps: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("networkProtocol")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={hy2Config.network}
                    onChange={(e) => setHy2Config({ ...hy2Config, network: e.target.value })}
                  >
                    <option value="">{t("allDefault")}</option>
                    <option value="tcp">{t("tcpOnly")}</option>
                    <option value="udp">{t("udpOnly")}</option>
                  </select>
                </div>
              </div>

              {/* 混淆配置 */}
              <div className="border-t pt-4 mt-4">
                <div className="space-y-2 mb-4">
                  <Label className="font-semibold">{t("quicObfs")}</Label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={hy2Config.obfs_type}
                    onChange={(e) => setHy2Config({ ...hy2Config, obfs_type: e.target.value })}
                  >
                    <option value="">{tc("disabled")}</option>
                    <option value="salamander">Salamander</option>
                  </select>
                </div>
                {hy2Config.obfs_type === "salamander" && (
                  <div className="space-y-2">
                    <Label>{t("obfsPassword")}</Label>
                    <Input
                      placeholder={t("obfsPassword")}
                      value={hy2Config.obfs_password}
                      onChange={(e) => setHy2Config({ ...hy2Config, obfs_password: e.target.value })}
                    />
                  </div>
                )}
              </div>

              {/* TLS 配置 */}
              <div className="border-t pt-4">
                <div className="flex items-center gap-4 mb-4">
                  <Label className="font-semibold">{t("tlsSettings")}</Label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={hy2Config.tls_insecure}
                      onChange={(e) => setHy2Config({ ...hy2Config, tls_insecure: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    {t("insecure")}
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("sniServerName")}</Label>
                    <Input
                      placeholder={t("sniPlaceholder")}
                      value={hy2Config.tls_server_name}
                      onChange={(e) => setHy2Config({ ...hy2Config, tls_server_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ALPN</Label>
                    <Input
                      placeholder="h3"
                      value={hy2Config.tls_alpn}
                      onChange={(e) => setHy2Config({ ...hy2Config, tls_alpn: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* WireGuard 配置 */}
            <TabsContent value="wireguard" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("serverAddr")}</Label>
                  <Input
                    placeholder="example.com"
                    value={wgConfig.server}
                    onChange={(e) => setWgConfig({ ...wgConfig, server: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{tc("port")}</Label>
                  <Input
                    type="number"
                    value={wgConfig.server_port}
                    onChange={(e) => setWgConfig({ ...wgConfig, server_port: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("localPrivateKey")}</Label>
                <Input
                  value={wgConfig.private_key}
                  onChange={(e) => setWgConfig({ ...wgConfig, private_key: e.target.value })}
                  placeholder={t("enterPrivateKey")}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("serverPublicKey")}</Label>
                <Input
                  value={wgConfig.peer_public_key}
                  onChange={(e) => setWgConfig({ ...wgConfig, peer_public_key: e.target.value })}
                  placeholder={t("serverPublicKeyPlaceholder")}
                  className="font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("presharedKeyOptional")}</Label>
                <Input
                  value={wgConfig.pre_shared_key}
                  onChange={(e) => setWgConfig({ ...wgConfig, pre_shared_key: e.target.value })}
                  placeholder="Pre-Shared Key"
                  className="font-mono text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t("localAddress")}</Label>
                  <Input
                    value={wgConfig.local_address}
                    onChange={(e) => setWgConfig({ ...wgConfig, local_address: e.target.value })}
                    placeholder="10.10.0.2/32"
                    className="font-mono text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>MTU</Label>
                  <Input
                    type="number"
                    value={wgConfig.mtu}
                    onChange={(e) => setWgConfig({ ...wgConfig, mtu: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Reserved (WARP)</Label>
                  <Input
                    value={wgConfig.reserved}
                    onChange={(e) => setWgConfig({ ...wgConfig, reserved: e.target.value })}
                    placeholder="0,0,0"
                    className="font-mono text-xs"
                  />
                  <p className="text-xs text-muted-foreground">{t("forCloudflareWarp")}</p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

      {error && (
        <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
      )}
    </div>
  )

  if (showCard) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>{content}</CardContent>
      </Card>
    )
  }

  return content
}
