"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react"
import { useSingboxConfigStore, DnsServer, DnsRule, DnsConfig } from "@/lib/store/singbox-config"

interface DnsConfigProps {
  showCard?: boolean
}

export function DnsConfigComponent({ showCard = true }: DnsConfigProps) {
  const { config, setDns } = useSingboxConfigStore()
  const initialConfig = config.dns

  const [servers, setServers] = useState<DnsServer[]>([])
  const [rules, setRules] = useState<DnsRule[]>([])
  const [finalServer, setFinalServer] = useState("")
  const [independentCache, setIndependentCache] = useState(true)
  const [expandedServers, setExpandedServers] = useState<Set<number>>(new Set())
  const [expandedRules, setExpandedRules] = useState<Set<number>>(new Set())

  const isInitializedRef = useRef(false)

  // 从 initialConfig 初始化
  useEffect(() => {
    if (isInitializedRef.current) return

    if (initialConfig) {
      if (initialConfig.servers) {
        setServers(initialConfig.servers)
      }
      if (initialConfig.rules) {
        setRules(initialConfig.rules)
      }
      if (initialConfig.final) {
        setFinalServer(initialConfig.final)
      }
      if (initialConfig.independent_cache !== undefined) {
        setIndependentCache(initialConfig.independent_cache)
      }
    }
    isInitializedRef.current = true
  }, [initialConfig])

  // 实时同步到 store
  useEffect(() => {
    if (!isInitializedRef.current) return

    const dnsConfig: DnsConfig = {
      servers: servers.filter((s) => s.tag && (s.type === "local" || s.type === "fakeip" || s.type === "dhcp" || s.type === "hosts" || s.server)),
      rules: rules.length > 0 ? rules : undefined,
      final: finalServer || undefined,
      independent_cache: independentCache,
    }

    setDns(dnsConfig)
  }, [servers, rules, finalServer, independentCache, setDns])

  // 获取可用的 DNS 服务器标签
  const availableServerTags = servers.filter((s) => s.tag).map((s) => s.tag)

  const addServer = () => {
    setServers([
      ...servers,
      {
        tag: `dns_${servers.length + 1}`,
        server: "",
        type: "udp",
      },
    ])
  }

  const removeServer = (index: number) => {
    setServers(servers.filter((_, i) => i !== index))
  }

  const updateServer = (index: number, field: keyof DnsServer, value: any) => {
    const newServers = [...servers]
    newServers[index] = { ...newServers[index], [field]: value }
    setServers(newServers)
  }

  const addRule = () => {
    setRules([
      ...rules,
      {
        action: "route",
        server: availableServerTags[0] || "",
      },
    ])
  }

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const updateRule = (index: number, field: keyof DnsRule, value: any) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], [field]: value }
    setRules(newRules)
  }

  const updateRuleArray = (index: number, field: "domain" | "domain_suffix" | "rule_set" | "query_type", value: string) => {
    const newRules = [...rules]
    if (field === "query_type") {
      const nums = value
        .split(",")
        .map((v) => parseInt(v.trim(), 10))
        .filter((v) => !isNaN(v))
      newRules[index] = { ...newRules[index], [field]: nums.length > 0 ? nums : undefined }
    } else {
      const arrayValue = value
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v)
      newRules[index] = { ...newRules[index], [field]: arrayValue.length > 0 ? arrayValue : undefined }
    }
    setRules(newRules)
  }

  // 预定义 DNS 模板
  const applyTemplate = (template: string) => {
    let templateServers: DnsServer[] = []
    let templateRules: DnsRule[] = []
    let templateFinal = ""

    switch (template) {
      case "china-optimized":
        templateServers = [
          { tag: "local_dns", server: "223.5.5.5", type: "udp" },
          { tag: "remote_dns", server: "8.8.8.8", type: "udp", detour: "proxy_out" },
        ]
        templateRules = [
          { action: "route", server: "local_dns", rule_set: ["geosite-cn"] },
        ]
        templateFinal = "remote_dns"
        break

      case "cloudflare-doh":
        templateServers = [
          { tag: "local_dns", server: "223.5.5.5", type: "udp" },
          {
            tag: "cloudflare_dns",
            server: "cloudflare-dns.com",
            type: "https",
            path: "/dns-query",
            detour: "proxy_out",
          },
        ]
        templateRules = [
          { action: "route", server: "local_dns", rule_set: ["geosite-cn"] },
        ]
        templateFinal = "cloudflare_dns"
        break

      case "google-doh":
        templateServers = [
          { tag: "local_dns", server: "223.5.5.5", type: "udp" },
          {
            tag: "google_dns",
            server: "dns.google",
            type: "https",
            path: "/dns-query",
            detour: "proxy_out",
          },
        ]
        templateRules = [
          { action: "route", server: "local_dns", rule_set: ["geosite-cn"] },
        ]
        templateFinal = "google_dns"
        break

      case "simple":
        templateServers = [
          { tag: "default_dns", server: "8.8.8.8", type: "udp" },
        ]
        templateRules = []
        templateFinal = "default_dns"
        break
    }

    setServers(templateServers)
    setRules(templateRules)
    setFinalServer(templateFinal)
  }

  const content = (
    <div className="space-y-4">
      {/* DNS 模板选择 */}
      <div className="space-y-2">
        <Label>快速模板</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("china-optimized")}>
            中国优化 (推荐)
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("cloudflare-doh")}>
            Cloudflare DoH
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("google-doh")}>
            Google DoH
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => applyTemplate("simple")}>
            简单模式
          </Button>
        </div>
      </div>

      {/* DNS 服务器列表 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>DNS 服务器</Label>
          <Button type="button" size="sm" variant="outline" onClick={addServer}>
            <Plus className="h-4 w-4 mr-1" />
            添加服务器
          </Button>
        </div>

        {servers.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
            暂无 DNS 服务器，使用上方快速模板或点击添加服务器按钮
          </div>
        )}

        {servers.map((server, index) => (
          <div key={index} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                placeholder="标签"
                value={server.tag}
                onChange={(e) => updateServer(index, "tag", e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[100px]"
                value={server.type || "udp"}
                onChange={(e) => updateServer(index, "type", e.target.value)}
              >
                <option value="udp">UDP</option>
                <option value="tcp">TCP</option>
                <option value="https">DoH</option>
                <option value="tls">DoT</option>
                <option value="quic">DoQ</option>
                <option value="h3">HTTP/3</option>
                <option value="local">Local</option>
                <option value="dhcp">DHCP</option>
                <option value="fakeip">FakeIP</option>
                <option value="hosts">Hosts</option>
              </select>
              {server.type !== "local" && server.type !== "fakeip" && server.type !== "dhcp" && (
                <Input
                  placeholder="服务器地址"
                  value={server.server || ""}
                  onChange={(e) => updateServer(index, "server", e.target.value)}
                  className="h-8 text-sm flex-[2]"
                />
              )}
              <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeServer(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            {/* 高级选项 */}
            <div className="border-t pt-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-xs w-full justify-between px-1"
                onClick={() => {
                  const newExpanded = new Set(expandedServers)
                  if (newExpanded.has(index)) {
                    newExpanded.delete(index)
                  } else {
                    newExpanded.add(index)
                  }
                  setExpandedServers(newExpanded)
                }}
              >
                <span>高级选项</span>
                {expandedServers.has(index) ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>

              {expandedServers.has(index) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {(server.type === "udp" || server.type === "tcp" || server.type === "tls" || server.type === "quic" || server.type === "https" || server.type === "http3") && (
                    <div className="space-y-1">
                      <Label className="text-xs">端口</Label>
                      <Input
                        type="number"
                        placeholder={server.type === "udp" || server.type === "tcp" ? "53" : (server.type === "tls" || server.type === "quic" ? "853" : "443")}
                        value={server.server_port || ""}
                        onChange={(e) => updateServer(index, "server_port", parseInt(e.target.value) || undefined)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  {(server.type === "https" || server.type === "http3") && (
                    <div className="space-y-1">
                      <Label className="text-xs">路径</Label>
                      <Input
                        placeholder="/dns-query"
                        value={server.path || ""}
                        onChange={(e) => updateServer(index, "path", e.target.value || undefined)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  {server.type === "dhcp" && (
                    <div className="space-y-1">
                      <Label className="text-xs">网络接口</Label>
                      <Input
                        placeholder="eth0"
                        value={server.interface || ""}
                        onChange={(e) => updateServer(index, "interface", e.target.value || undefined)}
                        className="h-8 text-sm"
                      />
                    </div>
                  )}

                  {server.type === "fakeip" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">IPv4 范围</Label>
                        <Input
                          placeholder="198.18.0.0/15"
                          value={server.inet4_range || ""}
                          onChange={(e) => updateServer(index, "inet4_range", e.target.value || undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IPv6 范围</Label>
                        <Input
                          placeholder="fc00::/18"
                          value={server.inet6_range || ""}
                          onChange={(e) => updateServer(index, "inet6_range", e.target.value || undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </>
                  )}

                  {server.type !== "local" && server.type !== "fakeip" && server.type !== "dhcp" && server.type !== "hosts" && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">出站代理</Label>
                        <Input
                          placeholder="proxy"
                          value={server.detour || ""}
                          onChange={(e) => updateServer(index, "detour", e.target.value || undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">域名解析器</Label>
                        <Input
                          placeholder="local_dns"
                          value={typeof server.domain_resolver === "string" ? server.domain_resolver : ""}
                          onChange={(e) => updateServer(index, "domain_resolver", e.target.value || undefined)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* DNS 规则 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>DNS 规则</Label>
          <Button type="button" size="sm" variant="outline" onClick={addRule} disabled={availableServerTags.length === 0}>
            <Plus className="h-4 w-4 mr-1" />
            添加规则
          </Button>
        </div>

        {rules.length === 0 && (
          <div className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
            暂无 DNS 规则，所有请求将使用默认服务器
          </div>
        )}

        {rules.map((rule, index) => (
          <div key={index} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[90px]"
                value={rule.action || "route"}
                onChange={(e) => updateRule(index, "action", e.target.value)}
              >
                <option value="route">route</option>
                <option value="reject">reject</option>
              </select>
              {(rule.action === "route" || !rule.action) && (
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm min-w-[120px]"
                  value={rule.server || ""}
                  onChange={(e) => updateRule(index, "server", e.target.value)}
                >
                  <option value="">选择服务器</option>
                  {availableServerTags.map((tag) => (
                    <option key={tag} value={tag}>
                      {tag}
                    </option>
                  ))}
                </select>
              )}
              <Input
                placeholder="规则集 (逗号分隔)"
                value={rule.rule_set?.join(", ") || ""}
                onChange={(e) => updateRuleArray(index, "rule_set", e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => removeRule(index)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>

            {/* 高级选项 */}
            <div className="border-t pt-2">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 text-xs w-full justify-between px-1"
                onClick={() => {
                  const newExpanded = new Set(expandedRules)
                  if (newExpanded.has(index)) {
                    newExpanded.delete(index)
                  } else {
                    newExpanded.add(index)
                  }
                  setExpandedRules(newExpanded)
                }}
              >
                <span>高级选项</span>
                {expandedRules.has(index) ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>

              {expandedRules.has(index) && (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">域名 (逗号分隔)</Label>
                    <Input
                      placeholder="google.com, github.com"
                      value={rule.domain?.join(", ") || ""}
                      onChange={(e) => updateRuleArray(index, "domain", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">域名后缀 (逗号分隔)</Label>
                    <Input
                      placeholder=".cn, .com.cn"
                      value={rule.domain_suffix?.join(", ") || ""}
                      onChange={(e) => updateRuleArray(index, "domain_suffix", e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label className="text-xs">Clash 模式</Label>
                    <select
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                      value={rule.clash_mode || ""}
                      onChange={(e) => updateRule(index, "clash_mode", e.target.value || undefined)}
                    >
                      <option value="">不限制</option>
                      <option value="Direct">Direct</option>
                      <option value="Global">Global</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 全局设置 */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">默认 DNS 服务器</Label>
            <select
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={finalServer}
              onChange={(e) => setFinalServer(e.target.value)}
            >
              <option value="">选择默认服务器</option>
              {availableServerTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pt-5">
            <input
              type="checkbox"
              id="independent_cache"
              checked={independentCache}
              onChange={(e) => setIndependentCache(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="independent_cache" className="text-xs">独立缓存</Label>
          </div>
        </div>
      </div>
    </div>
  )

  if (!showCard) {
    return content
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>DNS 配置</CardTitle>
        <CardDescription>配置 DNS 服务器和规则，控制域名解析方式</CardDescription>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  )
}
