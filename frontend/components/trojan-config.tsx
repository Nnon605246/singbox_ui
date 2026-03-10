"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Copy } from "lucide-react"
import { apiClient, type TrojanConfigParams } from "@/lib/api"

export function TrojanConfigGen() {
  const [config, setConfig] = useState<TrojanConfigParams>({
    address: "",
    port: 443,
    password: "",
    sni: "",
    network: "tcp",
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
      const xrayConfig = await apiClient.generateTrojanConfig(config)
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
        <CardTitle>Trojan 配置生成</CardTitle>
        <CardDescription>生成 Trojan 协议的 Xray 配置文件</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="trojan-address">服务器地址</Label>
              <Input
                id="trojan-address"
                placeholder="example.com"
                value={config.address}
                onChange={(e) => setConfig({ ...config, address: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trojan-port">端口</Label>
              <Input
                id="trojan-port"
                type="number"
                placeholder="443"
                value={config.port}
                onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) })}
                required
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="trojan-password">密码</Label>
              <Input
                id="trojan-password"
                type="password"
                placeholder="your-password"
                value={config.password}
                onChange={(e) => setConfig({ ...config, password: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trojan-network">Network</Label>
              <Input
                id="trojan-network"
                placeholder="tcp"
                value={config.network}
                onChange={(e) => setConfig({ ...config, network: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trojan-sni">SNI (可选)</Label>
              <Input
                id="trojan-sni"
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
