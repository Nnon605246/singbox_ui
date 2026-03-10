"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Copy, Plus, Trash2 } from "lucide-react"
import { apiClient, type WireGuardConfigParams, type WireGuardPeer } from "@/lib/api"

export function WireGuardConfigGen() {
  const [config, setConfig] = useState<WireGuardConfigParams>({
    privateKey: "",
    address: ["10.10.0.2/32"],
    peers: [
      {
        publicKey: "",
        endpoint: "",
        allowedIPs: ["0.0.0.0/0"],
      },
    ],
    mtu: 1420,
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
      const xrayConfig = await apiClient.generateWireGuardConfig(config)
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

  const addPeer = () => {
    setConfig({
      ...config,
      peers: [
        ...config.peers,
        { publicKey: "", endpoint: "", allowedIPs: ["0.0.0.0/0"] },
      ],
    })
  }

  const removePeer = (index: number) => {
    setConfig({
      ...config,
      peers: config.peers.filter((_, i) => i !== index),
    })
  }

  const updatePeer = (index: number, field: keyof WireGuardPeer, value: string) => {
    const newPeers = [...config.peers]
    if (field === "allowedIPs") {
      newPeers[index] = {
        ...newPeers[index],
        allowedIPs: value.split(",").map((s) => s.trim()),
      }
    } else {
      newPeers[index] = { ...newPeers[index], [field]: value }
    }
    setConfig({ ...config, peers: newPeers })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>WireGuard 配置生成</CardTitle>
        <CardDescription>生成 WireGuard 协议的 Xray 配置文件</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wg-privatekey">私钥 (Private Key)</Label>
              <Input
                id="wg-privatekey"
                placeholder="从 WireGuard 密钥生成获取"
                value={config.privateKey}
                onChange={(e) => setConfig({ ...config, privateKey: e.target.value })}
                required
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wg-address">地址 (逗号分隔)</Label>
              <Input
                id="wg-address"
                placeholder="10.10.0.2/32"
                value={config.address.join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    address: e.target.value.split(",").map((s) => s.trim()),
                  })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="wg-mtu">MTU</Label>
              <Input
                id="wg-mtu"
                type="number"
                placeholder="1420"
                value={config.mtu}
                onChange={(e) => setConfig({ ...config, mtu: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>对等节点 (Peers)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addPeer}>
                  <Plus className="h-4 w-4 mr-1" />
                  添加
                </Button>
              </div>

              {config.peers.map((peer, index) => (
                <Card key={index} className="p-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-sm font-semibold">Peer {index + 1}</Label>
                      {config.peers.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => removePeer(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">公钥 (Public Key)</Label>
                      <Input
                        placeholder="对端的公钥"
                        value={peer.publicKey}
                        onChange={(e) => updatePeer(index, "publicKey", e.target.value)}
                        required
                        className="font-mono text-xs"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">端点 (Endpoint)</Label>
                      <Input
                        placeholder="example.com:5353"
                        value={peer.endpoint}
                        onChange={(e) => updatePeer(index, "endpoint", e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">允许的 IP (逗号分隔)</Label>
                      <Input
                        placeholder="0.0.0.0/0"
                        value={peer.allowedIPs.join(", ")}
                        onChange={(e) => updatePeer(index, "allowedIPs", e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </Card>
              ))}
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
