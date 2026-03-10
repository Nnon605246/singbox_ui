"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { InboundConfig } from "@/components/inbound-config"
import { OutboundConfig } from "@/components/outbound-config"
import { RoutingConfig } from "@/components/routing-config"
import { DnsConfigComponent } from "@/components/dns-config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  RotateCw,
  RotateCcw,
  Save,
  FileText,
  Server,
  Shield,
  ArrowRightLeft,
  Route,
  Zap,
  Rss,
  Check,
  Globe,
  Copy,
  Plus,
  Play,
  Square,
  Trash2,
  Pencil,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SubscriptionManager } from "@/components/subscription-manager"
import { JsonEditor } from "@/components/json-editor"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { apiClient } from "@/lib/api"

export default function Home() {
  const { toast } = useToast()

  // 使用全局 store
  const {
    config,
    currentInstance,
    instances,
    setLogLevel,
    getFullConfig,
    setOutbound,
    resetConfig,
    loadConfig,
    isLoading,
    isSaving,
    lastSavedAt,
    loadInstances,
    loadInstanceConfig,
    saveInstanceConfig,
    createInstance,
    deleteInstance,
  } = useSingboxConfigStore()

  const [singboxVersion, setSingboxVersion] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"subscription" | "inbound" | "outbound" | "routing" | "dns">("inbound")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [instanceLogs, setInstanceLogs] = useState("")
  const [logsLoading, setLogsLoading] = useState(false)
  const [jsonEditMode, setJsonEditMode] = useState(false)
  const [editedJson, setEditedJson] = useState("")

  // 获取计算后的完整配置
  const fullConfig = getFullConfig()
  const hasConfig = (config.inbounds?.length ?? 0) > 0 || (config.outbounds?.length ?? 0) > 0

  // 初始化
  useEffect(() => {
    loadInstances()
    checkSingboxVersion()
    // 每5秒刷新实例状态
    const interval = setInterval(loadInstances, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkSingboxVersion = async () => {
    try {
      const response = await fetch("/api/singbox/version")
      if (response.ok) {
        const data = await response.json()
        setSingboxVersion(data.version)
      }
    } catch (error) {
      console.log("sing-box not installed")
    }
  }

  // 选择实例
  const handleInstanceSelect = async (instanceName: string) => {
    if (instanceName === currentInstance) return
    const loaded = await loadInstanceConfig(instanceName)
    if (loaded) {
      toast({
        title: "配置已加载",
        description: `已加载实例 "${instanceName}" 的配置`,
      })
    }
  }

  // 创建新实例
  const handleCreateInstance = async () => {
    const name = newInstanceName.trim()
    if (!name) {
      toast({
        title: "错误",
        description: "请输入实例名称",
        variant: "destructive",
      })
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      toast({
        title: "错误",
        description: "名称只能包含字母、数字、下划线和连字符",
        variant: "destructive",
      })
      return
    }

    if (instances.some(i => i.name === name)) {
      toast({
        title: "错误",
        description: "实例名称已存在",
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      // 先清空配置到默认值，再创建新实例
      resetConfig()
      const success = await createInstance(name)
      if (success) {
        toast({
          title: "创建成功",
          description: `实例 "${name}" 已创建`,
        })
        setNewInstanceName("")
        setCreateDialogOpen(false)
      } else {
        toast({
          title: "创建失败",
          description: "创建实例失败",
          variant: "destructive",
        })
      }
    } finally {
      setCreating(false)
    }
  }

  // 保存当前配置
  const handleSaveConfig = async () => {
    if (!currentInstance) {
      toast({
        title: "错误",
        description: "请先选择或创建一个实例",
        variant: "destructive",
      })
      return
    }

    const result = await saveInstanceConfig()
    if (result.success) {
      toast({
        title: "保存成功",
        description: `配置已保存到实例 "${currentInstance}"`,
      })
    } else {
      toast({
        title: "保存失败",
        description: result.error,
        variant: "destructive",
      })
    }
  }

  // 启动实例
  const handleRunInstance = async (name: string) => {
    setActionLoading(name)
    try {
      await apiClient.runInstance(name)
      toast({
        title: "启动成功",
        description: `实例 "${name}" 已启动`,
      })
      loadInstances()
    } catch (error) {
      toast({
        title: "启动失败",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  // 停止实例
  const handleStopInstance = async (name: string) => {
    setActionLoading(name)
    try {
      await apiClient.stopInstance(name)
      toast({
        title: "停止成功",
        description: `实例 "${name}" 已停止`,
      })
      loadInstances()
    } catch (error) {
      toast({
        title: "停止失败",
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  // 删除实例
  const handleDeleteInstance = async () => {
    if (!instanceToDelete) return
    const success = await deleteInstance(instanceToDelete)
    if (success) {
      toast({
        title: "删除成功",
        description: `实例 "${instanceToDelete}" 已删除`,
      })
    } else {
      toast({
        title: "删除失败",
        description: "删除实例失败",
        variant: "destructive",
      })
    }
    setDeleteDialogOpen(false)
    setInstanceToDelete(null)
  }

  // 重置配置 - 清空为默认空配置，但保留当前实例
  const handleResetConfig = () => {
    setResetDialogOpen(false)
    resetConfig()
    toast({
      title: "配置已重置",
      description: "所有配置已恢复为默认值",
    })
  }

  // 查看实例日志
  const handleViewLogs = async () => {
    if (!currentInstance) return
    setLogsLoading(true)
    setLogsDialogOpen(true)
    try {
      const response = await apiClient.getInstanceLogs(currentInstance)
      setInstanceLogs(response.logs || "暂无日志")
    } catch (error) {
      setInstanceLogs("获取日志失败: " + (error instanceof Error ? error.message : "未知错误"))
    } finally {
      setLogsLoading(false)
    }
  }

  // 处理出站配置变更（用于订阅节点选择）
  const handleOutboundChange = (outbound: any) => {
    if (outbound) {
      setOutbound(0, outbound)
    }
  }

  // 获取可用的出站标签（useMemo 稳定引用，避免子组件 useEffect 无限循环）
  const availableOutbounds = useMemo(() => {
    const tags = (config.outbounds ?? []).map((o) => o.tag).filter(Boolean)
    return tags.length > 0 ? tags : ["direct", "block"]
  }, [config.outbounds])

  const tabs = [
    { id: "subscription" as const, label: "订阅", icon: Rss },
    { id: "inbound" as const, label: "入站", icon: Shield },
    { id: "outbound" as const, label: "出站", icon: ArrowRightLeft },
    { id: "routing" as const, label: "路由", icon: Route },
    { id: "dns" as const, label: "DNS", icon: Globe },
  ]

  // 格式化最后保存时间
  const formatLastSaved = () => {
    if (!lastSavedAt) return null
    const diff = Date.now() - lastSavedAt
    if (diff < 60000) return "刚刚保存"
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前保存`
    return `${Math.floor(diff / 3600000)} 小时前保存`
  }

  // 获取当前实例信息
  const currentInstanceInfo = instances.find(i => i.name === currentInstance)

  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">sing-box 配置管理</h1>
                  <p className="text-xs text-muted-foreground">代理服务配置面板</p>
                </div>
              </div>
            </div>

            {/* Version Indicator */}
            <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2">
              <Server className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {singboxVersion || "检查中..."}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-[1800px]">
        {/* Instance Selector Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">当前实例</Label>
                <Select value={currentInstance || ""} onValueChange={handleInstanceSelect}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="选择实例..." />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        暂无实例，请点击"新建"创建
                      </div>
                    ) : (
                      instances.map((instance) => (
                        <SelectItem key={instance.name} value={instance.name}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${instance.running ? "bg-green-500" : "bg-gray-400"}`} />
                            {instance.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新建
                </Button>

                {currentInstance && currentInstanceInfo && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <Badge variant={currentInstanceInfo.running ? "default" : "secondary"}>
                      {currentInstanceInfo.running ? "运行中" : "已停止"}
                    </Badge>

                    {currentInstanceInfo.running ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStopInstance(currentInstance)}
                        disabled={actionLoading === currentInstance}
                      >
                        {actionLoading === currentInstance ? (
                          <RotateCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRunInstance(currentInstance)}
                        disabled={actionLoading === currentInstance}
                      >
                        {actionLoading === currentInstance ? (
                          <RotateCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewLogs}
                      disabled={!currentInstanceInfo.running}
                      title="查看日志"
                    >
                      <FileText className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInstanceToDelete(currentInstance)
                        setDeleteDialogOpen(true)
                      }}
                      disabled={currentInstanceInfo.running}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {lastSavedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500" />
                    {formatLastSaved()}
                  </div>
                )}

                <Button
                  onClick={() => setResetDialogOpen(true)}
                  variant="ghost"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重置
                </Button>

                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving || !currentInstance}
                  variant={currentInstance ? "default" : "outline"}
                >
                  {isSaving ? (
                    <>
                      <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                      保存中
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      保存配置
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">日志级别</Label>
                <Select value={config.log?.level ?? "info"} onValueChange={setLogLevel}>
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="trace">Trace</SelectItem>
                    <SelectItem value="debug">Debug</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="fatal">Fatal</SelectItem>
                    <SelectItem value="panic">Panic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RotateCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">加载配置中...</span>
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Panel - Configuration */}
            <div className="col-span-7 space-y-6">
              {/* Tab Navigation */}
              <div className="flex gap-2 p-1 rounded-xl bg-muted border border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="animate-fade-in">
                {activeTab === "subscription" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Rss className="h-5 w-5 text-primary" />
                        订阅管理
                      </CardTitle>
                      <CardDescription>管理订阅地址和节点</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SubscriptionManager
                        onNodeSelect={(node) => {
                          handleOutboundChange(node.outbound)
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "inbound" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        入站配置
                      </CardTitle>
                      <CardDescription>配置接收连接的方式和协议</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InboundConfig showCard={false} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "outbound" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        出站配置
                      </CardTitle>
                      <CardDescription>配置转发连接的目标和协议</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OutboundConfig showCard={false} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "routing" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Route className="h-5 w-5 text-primary" />
                        路由配置
                      </CardTitle>
                      <CardDescription>配置流量路由规则和策略</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RoutingConfig
                        showCard={false}
                        availableOutbounds={availableOutbounds}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "dns" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        DNS 配置
                      </CardTitle>
                      <CardDescription>配置 DNS 服务器和解析规则</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DnsConfigComponent showCard={false} />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="col-span-5 space-y-6">
              {/* Config Preview */}
              <Card className="sticky top-24">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        配置预览
                      </CardTitle>
                      <CardDescription>实时预览完整 JSON 配置</CardDescription>
                    </div>
                    {hasConfig && (
                      <div className="flex gap-2">
                        {jsonEditMode ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setJsonEditMode(false)
                                setEditedJson("")
                              }}
                            >
                              取消
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                try {
                                  const parsed = JSON.parse(editedJson)
                                  loadConfig(parsed)
                                  setJsonEditMode(false)
                                  setEditedJson("")
                                  toast({
                                    title: "已应用",
                                    description: "配置已更新",
                                  })
                                } catch (e) {
                                  toast({
                                    title: "JSON 格式错误",
                                    description: "请检查 JSON 格式是否正确",
                                    variant: "destructive",
                                  })
                                }
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              应用
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditedJson(JSON.stringify(fullConfig, null, 2))
                                setJsonEditMode(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(fullConfig, null, 2))
                                toast({
                                  title: "已复制",
                                  description: "配置已复制到剪贴板",
                                })
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {hasConfig ? (
                    <JsonEditor
                      value={jsonEditMode ? editedJson : JSON.stringify(fullConfig, null, 2)}
                      onChange={jsonEditMode ? setEditedJson : undefined}
                      readOnly={!jsonEditMode}
                      height="500px"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-sm">配置将在这里显示</p>
                      <p className="text-xs mt-1">请先配置入站或出站</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Create Instance Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新建配置实例</DialogTitle>
            <DialogDescription>
              创建一个新的配置实例。每个实例运行在独立的容器中。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">实例名称</Label>
              <Input
                id="instance-name"
                placeholder="例如: proxy-hk, proxy-us"
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateInstance()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                名称只能包含字母、数字、下划线和连字符
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              取消
            </Button>
            <Button onClick={handleCreateInstance} disabled={creating}>
              {creating ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  创建中
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  创建
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Instance Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除实例 "{instanceToDelete}" 吗？此操作不可撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInstance}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Config Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置</AlertDialogTitle>
            <AlertDialogDescription>
              确定要重置配置吗？所有未保存的更改都将丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfig}>
              重置
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>实例日志 - {currentInstance}</DialogTitle>
            <DialogDescription>
              查看当前运行实例的日志输出
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RotateCw className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">加载日志中...</span>
              </div>
            ) : (
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
                {instanceLogs || "暂无日志"}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              关闭
            </Button>
            <Button onClick={handleViewLogs} disabled={logsLoading}>
              <RotateCw className={`h-4 w-4 mr-2 ${logsLoading ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
