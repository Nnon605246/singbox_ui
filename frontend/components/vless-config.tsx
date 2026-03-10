"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Copy } from "lucide-react"
import { apiClient, type VLESSConfigParams } from "@/lib/api"

export function VLESSConfigGen() {
  const [config, setConfig] = useState<VLESSConfigParams>({
    address: "",
    port: 443,
    uuid: "",
    flow: "xtls-rprx-vision",
    network: "tcp",
    security: "tls",
    sni: "",
  })
  const [result, setResult] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setResult("")

    try {
      const xrayConfig = await apiClient.generateVLESSConfig(config)
      setResult(JSON.stringify(xrayConfig, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成配置失败")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(result)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>VLESS 配置生成</CardTitle>
        <CardDescription>生成 VLESS 协议的 Xray 配置文件</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vless-address">服务器地址</Label>
              <Input
                id="vless-address"
                placeholder="example.com"
                value={config.address}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vless-port">端口</Label>
              <Input
                id="vless-port"
                type="number"
                placeholder="443"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vless-uuid">UUID</Label>
              <Input
                id="vless-uuid"
                placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890"
                value={config.uuid}
                onChange={(e) => setConfig({ ...config, uuid: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vless-flow">Flow (可选)</Label>
              <Input
                id="vless-flow"
                placeholder="xtls-rprx-vision"
                value={config.flow}
                onChange={(e) => setConfig({ ...config, flow: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vless-network">Network</Label>
              <Input
                id="vless-network"
                placeholder="tcp"
                value={config.network}
                onChange={(e) => setConfig({ ...config, network: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vless-security">Security (可选)</Label>
              <Input
                id="vless-security"
                placeholder="tls"
                value={config.security}
                onChange={(e) => setConfig({ ...config, security: e.target.value })}
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="vless-sni">SNI (可选)</Label>
              <Input
                id="vless-sni"
                placeholder="example.com"
                value={config.sni}
                onChange={(e) => setConfig({ ...config, sni: e.target.value })}
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "生成中..." : "生成配置"}
          </Button>
        </form>

        {error && (
          <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label>生成的配置</Label>
              <Button size="sm" variant="outline" onClick={copyToClipboard}>
                <Copy className="h-4 w-4 mr-2" />
                复制
              </Button>
            </div>
            <Textarea
              value={result}
              readOnly
              className="font-mono text-xs min-h-[400px]"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
