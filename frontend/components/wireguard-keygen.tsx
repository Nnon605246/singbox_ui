"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, Key } from "lucide-react"
import { apiClient } from "@/lib/api"

export function WireGuardKeyGen() {
  const [privateKey, setPrivateKey] = useState("")
  const [publicKey, setPublicKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const generateKeys = async () => {
    setLoading(true)
    setError("")
    try {
      const result = await apiClient.generateWireGuardKeys()
      setPrivateKey(result.privateKey)
      setPublicKey(result.publicKey)
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成密钥失败")
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          WireGuard 密钥生成
        </CardTitle>
        <CardDescription>
          生成 WireGuard 密钥对（基于 Curve25519）
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={generateKeys} disabled={loading} className="w-full">
          {loading ? "生成中..." : "生成密钥对"}
        </Button>

        {error && (
          <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
            {error}
          </div>
        )}

        {privateKey && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="privateKey">私钥 (Private Key)</Label>
              <div className="flex gap-2">
                <Input
                  id="privateKey"
                  value={privateKey}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(privateKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicKey">公钥 (Public Key)</Label>
              <div className="flex gap-2">
                <Input
                  id="publicKey"
                  value={publicKey}
                  readOnly
                  className="font-mono text-xs"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(publicKey)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
