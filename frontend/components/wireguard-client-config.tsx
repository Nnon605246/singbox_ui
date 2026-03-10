"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, RotateCw, Save, FileText } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WireguardClientConfigProps {
  serverConfig?: any // 服务器端WireGuard配置
}

export function WireguardClientConfig({ serverConfig }: WireguardClientConfigProps) {
  const { toast } = useToast()
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [clientConfig, setClientConfig] = useState<{
    privateKey: string
    publicKey: string
    address: string
    dns: string
    serverPublicKey: string
    serverEndpoint: string
    allowedIPs: string
    persistentKeepalive: string
  } | null>(null)

  // 组件加载时从后端加载已保存的配置
  useEffect(() => {
    loadSavedConfig()
  }, [])

  // 从后端加载已保存的配置
  const loadSavedConfig = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/wireguard/client-config")
      if (response.ok) {
        const config = await response.json()
        setClientConfig(config)
        toast({
          title: "已加载配置",
          description: "成功加载已保存的客户端配置",
        })
      }
    } catch (error) {
      console.log("No saved config found")
    } finally {
      setLoading(false)
    }
  }

  // 保存配置到后端文件
  const saveConfigToFile = async () => {
    if (!clientConfig) return

    setSaving(true)
    try {
      const response = await fetch("/api/wireguard/client-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientConfig),
      })

      if (response.ok) {
        toast({
          title: "保存成功",
          description: "客户端配置已保存到服务器",
        })
      } else {
        throw new Error("Failed to save config")
      }
    } catch (error) {
      toast({
        title: "保存失败",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // 从后端生成客户端密钥
  const generateClientKeys = async () => {
    try {
      // 客户端配置默认使用 10.10.0.2
      const response = await fetch("/api/wireguard/keygen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ip: "10.10.0.2"
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || error.error || "Failed to generate keys")
      }

      const data = await response.json()
      return {
        privateKey: data.privateKey,
        publicKey: data.publicKey,
      }
    } catch (error) {
      throw new Error(`生成密钥失败: ${error}`)
    }
  }

  // 生成客户端配置
  const generateConfig = async () => {
    if (!serverConfig || !serverConfig.settings) {
      toast({
        title: "错误",
        description: "请先配置入站 WireGuard",
        variant: "destructive",
      })
      return
    }

    setGenerating(true)
    try {
      // 生成客户端密钥对
      const clientKeys = await generateClientKeys()

      // 从服务器配置中提取信息
      const settings = serverConfig.settings
      const serverPeer = settings.peers && settings.peers.length > 0 ? settings.peers[0] : null

      if (!serverPeer) {
        throw new Error("服务器配置中没有对等节点信息")
      }

      // 构建客户端配置
      const config = {
        privateKey: clientKeys.privateKey,
        publicKey: clientKeys.publicKey,
        address: "10.10.0.2/24", // 默认客户端地址
        dns: "1.1.1.1, 8.8.8.8",
        serverPublicKey: serverPeer.publicKey,
        serverEndpoint: serverPeer.endpoint || "your-server-ip:5353",
        allowedIPs: "0.0.0.0/0, ::/0",
        persistentKeepalive: "25",
      }

      setClientConfig(config)
      // 自动保存到文件
      await saveConfigToBackend(config)
      toast({
        title: "生成成功",
        description: "客户端配置已生成并保存",
      })
    } catch (error) {
      toast({
        title: "生成失败",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setGenerating(false)
    }
  }

  // 保存配置到后端
  const saveConfigToBackend = async (config: any) => {
    try {
      const response = await fetch("/api/wireguard/client-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      if (!response.ok) {
        throw new Error("Failed to save config")
      }
    } catch (error) {
      console.error("Failed to save config to backend:", error)
      // 不显示错误toast，因为这是自动保存
    }
  }


  // 生成配置文件内容
  const getConfigFileContent = () => {
    if (!clientConfig) return ""

    return `[Interface]
PrivateKey = ${clientConfig.privateKey}
Address = ${clientConfig.address}
DNS = ${clientConfig.dns}

[Peer]
PublicKey = ${clientConfig.serverPublicKey}
Endpoint = ${clientConfig.serverEndpoint}
AllowedIPs = ${clientConfig.allowedIPs}
PersistentKeepalive = ${clientConfig.persistentKeepalive}
`
  }

  // 下载配置文件
  const downloadConfig = () => {
    if (!clientConfig) return

    const content = getConfigFileContent()
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "wireguard-client.conf"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({
      title: "下载成功",
      description: "客户端配置文件已下载",
    })
  }

  // 更新配置字段
  const updateConfigField = (field: string, value: string) => {
    if (!clientConfig) return
    setClientConfig({
      ...clientConfig,
      [field]: value,
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>WireGuard 客户端配置生成</CardTitle>
            <CardDescription>生成客户端配置文件用于连接服务器</CardDescription>
          </div>
          <Button onClick={generateConfig} disabled={generating || !serverConfig}>
            {generating ? (
              <>
                <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                生成中...
              </>
            ) : (
              "生成客户端配置"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!clientConfig ? (
          <div className="text-center text-muted-foreground py-8">
            {!serverConfig
              ? "请先配置入站 WireGuard 后再生成客户端配置"
              : "点击上方按钮生成客户端配置"}
          </div>
        ) : (
          <div className="space-y-4">
            {/* 客户端信息 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>客户端公钥</Label>
                <Input value={clientConfig.publicKey} readOnly className="font-mono text-xs" />
              </div>
              <div>
                <Label>客户端地址</Label>
                <Input
                  value={clientConfig.address}
                  onChange={(e) => updateConfigField("address", e.target.value)}
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>DNS 服务器</Label>
                <Input
                  value={clientConfig.dns}
                  onChange={(e) => updateConfigField("dns", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>服务器端点</Label>
                <Input
                  value={clientConfig.serverEndpoint}
                  onChange={(e) => updateConfigField("serverEndpoint", e.target.value)}
                  placeholder="server-ip:port"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>允许的 IP</Label>
                <Input
                  value={clientConfig.allowedIPs}
                  onChange={(e) => updateConfigField("allowedIPs", e.target.value)}
                  className="font-mono"
                />
              </div>
              <div>
                <Label>保活间隔 (秒)</Label>
                <Input
                  value={clientConfig.persistentKeepalive}
                  onChange={(e) => updateConfigField("persistentKeepalive", e.target.value)}
                  type="number"
                />
              </div>
            </div>

            {/* 配置文件预览 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>配置文件预览</Label>
                <Button onClick={downloadConfig} size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  下载配置文件
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-lg overflow-auto text-xs font-mono whitespace-pre">
                {getConfigFileContent()}
              </pre>
            </div>

            {/* 使用说明 */}
            <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold mb-2">使用说明：</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>下载生成的配置文件 wireguard-client.conf</li>
                <li>在客户端设备上安装 WireGuard</li>
                <li>导入配置文件到 WireGuard 客户端</li>
                <li>将客户端公钥添加到服务器的对等节点列表中</li>
                <li>连接并测试</li>
              </ol>
            </div>

            {/* 故障排查 */}
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <h4 className="font-semibold mb-2">⚠️ 只有发送流量没有接收流量？</h4>
              <p className="text-sm mb-2">这是常见的 WireGuard 配置问题，请检查以下几点：</p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>
                  <strong>服务器防火墙设置</strong>
                  <div className="ml-6 mt-1 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded font-mono">
                    # 允许 WireGuard 端口 (UDP)<br />
                    firewall-cmd --permanent --add-port=5353/udp<br />
                    firewall-cmd --reload
                  </div>
                </li>
                <li>
                  <strong>启用 IP 转发</strong>
                  <div className="ml-6 mt-1 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded font-mono">
                    # 临时启用<br />
                    sysctl -w net.ipv4.ip_forward=1<br />
                    # 永久启用<br />
                    echo "net.ipv4.ip_forward=1" {'>>'} /etc/sysctl.conf<br />
                    sysctl -p
                  </div>
                </li>
                <li>
                  <strong>配置 NAT 转发</strong>
                  <div className="ml-6 mt-1 text-xs bg-gray-100 dark:bg-gray-900 p-2 rounded font-mono">
                    # 添加 iptables 规则<br />
                    iptables -t nat -A POSTROUTING -s 10.10.0.0/24 -o eth0 -j MASQUERADE<br />
                    # 保存规则<br />
                    iptables-save {'>'}  /etc/iptables/rules.v4
                  </div>
                </li>
                <li>
                  <strong>将日志级别设置为 debug</strong>
                  <div className="ml-6 mt-1">在配置预览中将日志级别改为 "Debug"，然后查看运行日志</div>
                </li>
                <li>
                  <strong>检查客户端公钥</strong>
                  <div className="ml-6 mt-1">确保客户端公钥（上方显示的）已添加到服务器配置的 peers 列表中</div>
                </li>
                <li>
                  <strong>验证端点地址</strong>
                  <div className="ml-6 mt-1">确保 "服务器端点" 填写了正确的服务器公网 IP 和端口</div>
                </li>
              </ol>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
