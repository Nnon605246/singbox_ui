package handlers

import (
	"net/http"
	"singbox-config-service/services"

	"github.com/gin-gonic/gin"
)

// ProberNodeRequest 添加节点请求
type ProberNodeRequest struct {
	Tag      string `json:"tag" binding:"required"`
	Protocol string `json:"protocol" binding:"required"`
	Address  string `json:"address" binding:"required"`
	Port     int    `json:"port" binding:"required"`
}

// ProberNodesRequest 批量添加节点请求
type ProberNodesRequest struct {
	Nodes []ProberNodeRequest `json:"nodes" binding:"required"`
}

// GetProberStatus 获取探测器状态
func GetProberStatus(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	c.JSON(http.StatusOK, prober.GetStats())
}

// GetProbeResults 获取所有探测结果
func GetProbeResults(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	results := prober.GetAllResults()
	c.JSON(http.StatusOK, gin.H{
		"count":   len(results),
		"results": results,
	})
}

// GetProbeResult 获取单个节点探测结果
func GetProbeResult(c *gin.Context) {
	tag := c.Param("tag")
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Node tag is required",
		})
		return
	}

	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	result := prober.GetResult(tag)
	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Node not found",
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// GetBestNode 获取最佳节点 (延迟最低)
func GetBestNode(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	best := prober.GetBestNode()
	if best == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "No online nodes available",
			"message": "All nodes are offline or no nodes registered",
		})
		return
	}

	c.JSON(http.StatusOK, best)
}

// GetOnlineNodes 获取所有在线节点
func GetOnlineNodes(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	online := prober.GetOnlineNodes()
	c.JSON(http.StatusOK, gin.H{
		"count": len(online),
		"nodes": online,
	})
}

// AddProberNode 添加探测节点
func AddProberNode(c *gin.Context) {
	var req ProberNodeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	prober.AddNode(services.ProbeNode{
		Tag:      req.Tag,
		Protocol: req.Protocol,
		Address:  req.Address,
		Port:     req.Port,
	})

	c.JSON(http.StatusOK, gin.H{
		"message": "Node added successfully",
		"tag":     req.Tag,
	})
}

// UpdateProberNodes 批量更新探测节点
func UpdateProberNodes(c *gin.Context) {
	var req ProberNodesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	nodes := make([]services.ProbeNode, len(req.Nodes))
	for i, n := range req.Nodes {
		nodes[i] = services.ProbeNode{
			Tag:      n.Tag,
			Protocol: n.Protocol,
			Address:  n.Address,
			Port:     n.Port,
		}
	}

	prober.UpdateNodes(nodes)

	// 保存到文件
	if err := prober.SaveNodesToFile(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save nodes: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Nodes updated successfully",
		"count":   len(nodes),
	})
}

// RemoveProberNode 移除探测节点
func RemoveProberNode(c *gin.Context) {
	tag := c.Param("tag")
	if tag == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Node tag is required",
		})
		return
	}

	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	prober.RemoveNode(tag)

	c.JSON(http.StatusOK, gin.H{
		"message": "Node removed successfully",
		"tag":     tag,
	})
}

// ClearProberNodes 清空所有探测节点
func ClearProberNodes(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	prober.ClearNodes()

	c.JSON(http.StatusOK, gin.H{
		"message": "All nodes cleared",
	})
}

// StartProber 启动探测器
func StartProber(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	if prober.IsRunning() {
		c.JSON(http.StatusOK, gin.H{
			"message": "Prober is already running",
		})
		return
	}

	prober.Start()

	c.JSON(http.StatusOK, gin.H{
		"message": "Prober started",
	})
}

// StopProber 停止探测器
func StopProber(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	if !prober.IsRunning() {
		c.JSON(http.StatusOK, gin.H{
			"message": "Prober is not running",
		})
		return
	}

	prober.Stop()

	c.JSON(http.StatusOK, gin.H{
		"message": "Prober stopped",
	})
}

// SyncNodesFromSubscription 从订阅数据同步节点到探测器
func SyncNodesFromSubscription(c *gin.Context) {
	// 加载所有订阅的所有节点
	allNodes, err := services.GetAllNodes()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "No subscription data found: " + err.Error(),
		})
		return
	}

	if len(allNodes) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "No nodes in subscription",
		})
		return
	}

	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	// 转换节点格式，使用 outbound 中已生成的 tag
	nodes := make([]services.ProbeNode, 0, len(allNodes))
	for _, n := range allNodes {
		// 使用 outbound 中的 tag（由 subscription.go 的 sanitizeTag 生成）
		// 这样可以确保 prober 和 subscription 使用相同的 tag
		tag := ""
		if outbound := n.Outbound; outbound != nil {
			if t, ok := outbound["tag"].(string); ok {
				tag = t
			}
		}
		// 如果 outbound 中没有 tag，使用 sanitizeTag 逻辑生成
		if tag == "" {
			tag = services.SanitizeTag(n.Protocol, n.Address, n.Port)
		}

		nodes = append(nodes, services.ProbeNode{
			Tag:      tag,
			Protocol: n.Protocol,
			Address:  n.Address,
			Port:     n.Port,
		})
	}

	prober.UpdateNodes(nodes)

	// 如果探测器未运行，自动启动
	if !prober.IsRunning() {
		prober.Start()
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "Nodes synced from subscription",
		"nodeCount": len(nodes),
	})
}

// SaveProbeResultsToSubscription 将测速结果保存到订阅文件
func SaveProbeResultsToSubscription(c *gin.Context) {
	prober := services.GetProber()
	if prober == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "Prober not initialized",
		})
		return
	}

	// 获取所有测速结果
	results := prober.GetAllResults()
	if len(results) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No probe results to save",
			"count":   0,
		})
		return
	}

	// 转换为更新格式
	updates := make([]services.ProbeResultUpdate, 0, len(results))
	for _, r := range results {
		updates = append(updates, services.ProbeResultUpdate{
			Tag:         r.NodeTag,
			Latency:     r.Latency,
			Online:      r.Status == "online",
			LastProbe:   r.LastProbe.Format("2006-01-02 15:04:05"),
			SuccessRate: int(r.SuccessRate),
		})
	}

	// 保存到订阅文件
	if err := services.UpdateProbeResults(updates); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to save probe results: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Probe results saved to subscription",
		"count":   len(updates),
	})
}
