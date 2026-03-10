package services

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"time"
)

// ProbeResult 单个节点的探测结果
type ProbeResult struct {
	NodeTag     string    `json:"nodeTag"`
	Protocol    string    `json:"protocol"`
	Address     string    `json:"address"`
	Port        int       `json:"port"`
	Latency     int64     `json:"latency"`     // 延迟 (毫秒), -1 表示超时/失败
	Status      string    `json:"status"`      // "online" | "offline" | "timeout" | "unknown"
	LastProbe   time.Time `json:"lastProbe"`   // 最后探测时间
	FailCount   int       `json:"failCount"`   // 连续失败次数
	SuccessRate float64   `json:"successRate"` // 成功率 (0-100)
}

// ProberConfig 探测器配置
type ProberConfig struct {
	ProbeInterval   time.Duration `json:"probeInterval"`   // 探测间隔
	ProbeTimeout    time.Duration `json:"probeTimeout"`    // 单次探测超时
	MaxRetries      int           `json:"maxRetries"`      // 最大重试次数
	MaxConcurrent   int           `json:"maxConcurrent"`   // 最大并发探测数
	ProbeURL        string        `json:"probeURL"`        // HTTP 探测 URL
	HistorySize     int           `json:"historySize"`     // 历史记录大小 (用于计算成功率)
	EnableTCPProbe  bool          `json:"enableTCPProbe"`  // 启用 TCP 探测
	EnableHTTPProbe bool          `json:"enableHTTPProbe"` // 启用 HTTP 探测
}

// ProbeNode 待探测节点信息
type ProbeNode struct {
	Tag      string `json:"tag"`
	Protocol string `json:"protocol"`
	Address  string `json:"address"`
	Port     int    `json:"port"`
}

// nodeHistory 节点历史记录 (用于计算成功率) - 线程安全
type nodeHistory struct {
	mu      sync.Mutex
	results []bool // true = 成功, false = 失败
	index   int    // 环形缓冲区索引
	size    int    // 历史记录大小
}

// update 更新历史记录并返回成功率
func (h *nodeHistory) update(success bool) float64 {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.results[h.index] = success
	h.index = (h.index + 1) % h.size

	// 计算成功率
	successCount := 0
	for _, r := range h.results {
		if r {
			successCount++
		}
	}
	return float64(successCount) / float64(h.size) * 100
}

// Prober 异步高频探测器
type Prober struct {
	config     ProberConfig
	nodes      sync.Map // map[string]ProbeNode
	results    sync.Map // map[string]*ProbeResult
	history    sync.Map // map[string]*nodeHistory
	running    int32    // 使用原子操作，0=停止, 1=运行
	stopChan   chan struct{}
	wg         sync.WaitGroup
	mu         sync.Mutex // 保护 stopChan 的创建和关闭
	httpClient *http.Client
	semaphore  chan struct{} // 并发控制信号量
	ctx        context.Context
	cancel     context.CancelFunc
}

// DefaultProberConfig 默认探测器配置
func DefaultProberConfig() ProberConfig {
	return ProberConfig{
		ProbeInterval:   30 * time.Second,
		ProbeTimeout:    5 * time.Second,
		MaxRetries:      2,
		MaxConcurrent:   10,
		ProbeURL:        "http://www.google.com/generate_204",
		HistorySize:     10,
		EnableTCPProbe:  true,
		EnableHTTPProbe: false, // 默认只做 TCP 探测，HTTP 探测可选
	}
}

// 全局探测器实例
var (
	globalProber *Prober
	proberMutex  sync.RWMutex
)

// NewProber 创建新的探测器实例
func NewProber(config ProberConfig) *Prober {
	ctx, cancel := context.WithCancel(context.Background())
	p := &Prober{
		config:    config,
		stopChan:  make(chan struct{}),
		semaphore: make(chan struct{}, config.MaxConcurrent),
		ctx:       ctx,
		cancel:    cancel,
		httpClient: &http.Client{
			Timeout: config.ProbeTimeout,
			Transport: &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
				DialContext: (&net.Dialer{
					Timeout:   config.ProbeTimeout,
					KeepAlive: 30 * time.Second,
				}).DialContext,
				MaxIdleConns:        100,
				IdleConnTimeout:     90 * time.Second,
				DisableCompression:  true,
				DisableKeepAlives:   false,
				MaxIdleConnsPerHost: 10,
			},
		},
	}
	return p
}

// InitProber 初始化全局探测器
func InitProber() error {
	proberMutex.Lock()
	defer proberMutex.Unlock()

	if globalProber != nil {
		return nil
	}

	config := DefaultProberConfig()

	// 从环境变量读取配置
	if interval := os.Getenv("PROBER_INTERVAL"); interval != "" {
		if d, err := time.ParseDuration(interval); err == nil {
			config.ProbeInterval = d
		}
	}
	if timeout := os.Getenv("PROBER_TIMEOUT"); timeout != "" {
		if d, err := time.ParseDuration(timeout); err == nil {
			config.ProbeTimeout = d
		}
	}

	globalProber = NewProber(config)
	log.Printf("Prober initialized with interval=%v, timeout=%v", config.ProbeInterval, config.ProbeTimeout)
	return nil
}

// GetProber 获取全局探测器实例
func GetProber() *Prober {
	proberMutex.RLock()
	defer proberMutex.RUnlock()
	return globalProber
}

// Start 启动探测器
func (p *Prober) Start() {
	// 使用原子操作检查和设置运行状态
	if !atomic.CompareAndSwapInt32(&p.running, 0, 1) {
		return // 已经在运行
	}

	p.mu.Lock()
	// 重新创建 context 和 stopChan
	p.ctx, p.cancel = context.WithCancel(context.Background())
	p.stopChan = make(chan struct{})
	p.mu.Unlock()

	log.Println("Prober started")

	p.wg.Add(1)
	go p.probeLoop()
}

// Stop 停止探测器
func (p *Prober) Stop() {
	// 使用原子操作检查和设置运行状态
	if !atomic.CompareAndSwapInt32(&p.running, 1, 0) {
		return // 已经停止
	}

	p.mu.Lock()
	// 取消 context
	if p.cancel != nil {
		p.cancel()
	}
	// 关闭 stopChan
	close(p.stopChan)
	p.mu.Unlock()

	// 等待探测循环结束
	p.wg.Wait()

	// 关闭 HTTP 客户端的空闲连接
	if transport, ok := p.httpClient.Transport.(*http.Transport); ok {
		transport.CloseIdleConnections()
	}

	log.Println("Prober stopped")
}

// IsRunning 检查探测器是否在运行
func (p *Prober) IsRunning() bool {
	return atomic.LoadInt32(&p.running) == 1
}

// AddNode 添加待探测节点
func (p *Prober) AddNode(node ProbeNode) {
	p.nodes.Store(node.Tag, node)

	// 初始化结果
	result := &ProbeResult{
		NodeTag:   node.Tag,
		Protocol:  node.Protocol,
		Address:   node.Address,
		Port:      node.Port,
		Latency:   -1,
		Status:    "unknown",
		LastProbe: time.Time{},
	}
	p.results.Store(node.Tag, result)

	// 初始化历史记录
	history := &nodeHistory{
		results: make([]bool, p.config.HistorySize),
		index:   0,
		size:    p.config.HistorySize,
	}
	p.history.Store(node.Tag, history)

	log.Printf("Prober: added node %s (%s://%s:%d)", node.Tag, node.Protocol, node.Address, node.Port)
}

// RemoveNode 移除节点
func (p *Prober) RemoveNode(tag string) {
	p.nodes.Delete(tag)
	p.results.Delete(tag)
	p.history.Delete(tag)
	log.Printf("Prober: removed node %s", tag)
}

// ClearNodes 清空所有节点
func (p *Prober) ClearNodes() {
	p.nodes.Range(func(key, value interface{}) bool {
		p.nodes.Delete(key)
		return true
	})
	p.results.Range(func(key, value interface{}) bool {
		p.results.Delete(key)
		return true
	})
	p.history.Range(func(key, value interface{}) bool {
		p.history.Delete(key)
		return true
	})
	log.Println("Prober: cleared all nodes")
}

// UpdateNodes 批量更新节点 (替换所有现有节点)
func (p *Prober) UpdateNodes(nodes []ProbeNode) {
	p.ClearNodes()
	for _, node := range nodes {
		p.AddNode(node)
	}
	log.Printf("Prober: updated with %d nodes", len(nodes))
}

// GetResult 获取单个节点的探测结果 (返回副本以避免竞态)
func (p *Prober) GetResult(tag string) *ProbeResult {
	if result, ok := p.results.Load(tag); ok {
		r := result.(*ProbeResult)
		// 返回副本
		return &ProbeResult{
			NodeTag:     r.NodeTag,
			Protocol:    r.Protocol,
			Address:     r.Address,
			Port:        r.Port,
			Latency:     r.Latency,
			Status:      r.Status,
			LastProbe:   r.LastProbe,
			FailCount:   r.FailCount,
			SuccessRate: r.SuccessRate,
		}
	}
	return nil
}

// GetAllResults 获取所有节点的探测结果
func (p *Prober) GetAllResults() map[string]*ProbeResult {
	results := make(map[string]*ProbeResult)
	p.results.Range(func(key, value interface{}) bool {
		r := value.(*ProbeResult)
		// 返回副本
		results[key.(string)] = &ProbeResult{
			NodeTag:     r.NodeTag,
			Protocol:    r.Protocol,
			Address:     r.Address,
			Port:        r.Port,
			Latency:     r.Latency,
			Status:      r.Status,
			LastProbe:   r.LastProbe,
			FailCount:   r.FailCount,
			SuccessRate: r.SuccessRate,
		}
		return true
	})
	return results
}

// GetBestNode 获取延迟最低的在线节点
func (p *Prober) GetBestNode() *ProbeResult {
	var best *ProbeResult
	p.results.Range(func(key, value interface{}) bool {
		result := value.(*ProbeResult)
		if result.Status == "online" && result.Latency > 0 {
			if best == nil || result.Latency < best.Latency {
				// 复制结果
				best = &ProbeResult{
					NodeTag:     result.NodeTag,
					Protocol:    result.Protocol,
					Address:     result.Address,
					Port:        result.Port,
					Latency:     result.Latency,
					Status:      result.Status,
					LastProbe:   result.LastProbe,
					FailCount:   result.FailCount,
					SuccessRate: result.SuccessRate,
				}
			}
		}
		return true
	})
	return best
}

// GetOnlineNodes 获取所有在线节点
func (p *Prober) GetOnlineNodes() []*ProbeResult {
	var online []*ProbeResult
	p.results.Range(func(key, value interface{}) bool {
		result := value.(*ProbeResult)
		if result.Status == "online" {
			// 返回副本
			online = append(online, &ProbeResult{
				NodeTag:     result.NodeTag,
				Protocol:    result.Protocol,
				Address:     result.Address,
				Port:        result.Port,
				Latency:     result.Latency,
				Status:      result.Status,
				LastProbe:   result.LastProbe,
				FailCount:   result.FailCount,
				SuccessRate: result.SuccessRate,
			})
		}
		return true
	})
	return online
}

// probeLoop 探测循环
func (p *Prober) probeLoop() {
	defer p.wg.Done()

	// 立即执行一次探测
	p.probeAllNodes()

	ticker := time.NewTicker(p.config.ProbeInterval)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopChan:
			return
		case <-p.ctx.Done():
			return
		case <-ticker.C:
			p.probeAllNodes()
		}
	}
}

// probeAllNodes 并发探测所有节点
func (p *Prober) probeAllNodes() {
	var wg sync.WaitGroup

	p.nodes.Range(func(key, value interface{}) bool {
		// 检查是否已停止
		if !p.IsRunning() {
			return false
		}

		node := value.(ProbeNode)

		wg.Add(1)
		go func(n ProbeNode) {
			defer wg.Done()

			// 使用 context 进行超时控制和取消
			select {
			case p.semaphore <- struct{}{}:
				// 获取到信号量
				defer func() { <-p.semaphore }()
				p.probeNode(n)
			case <-p.ctx.Done():
				// 探测器已停止
				return
			}
		}(node)

		return true
	})

	wg.Wait()
}

// probeNode 探测单个节点 (带重试)
func (p *Prober) probeNode(node ProbeNode) {
	var latency int64 = -1
	var success bool

	for retry := 0; retry <= p.config.MaxRetries; retry++ {
		// 检查是否已停止
		if !p.IsRunning() {
			return
		}

		if retry > 0 {
			// 使用可取消的 sleep
			select {
			case <-time.After(time.Duration(retry*500) * time.Millisecond):
			case <-p.ctx.Done():
				return
			}
		}

		start := time.Now()

		if p.config.EnableTCPProbe {
			success = p.tcpProbe(node.Address, node.Port)
		} else if p.config.EnableHTTPProbe {
			success = p.httpProbe()
		} else {
			success = p.tcpProbe(node.Address, node.Port)
		}

		if success {
			latency = time.Since(start).Milliseconds()
			break
		}
	}

	// 更新结果
	p.updateResult(node.Tag, latency, success)
}

// tcpProbe TCP 连接探测 (支持 context 取消)
func (p *Prober) tcpProbe(address string, port int) bool {
	addr := fmt.Sprintf("%s:%d", address, port)

	// 使用带 context 的 Dialer
	dialer := &net.Dialer{
		Timeout: p.config.ProbeTimeout,
	}

	conn, err := dialer.DialContext(p.ctx, "tcp", addr)
	if err != nil {
		return false
	}
	conn.Close()
	return true
}

// httpProbe HTTP 探测
func (p *Prober) httpProbe() bool {
	ctx, cancel := context.WithTimeout(p.ctx, p.config.ProbeTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(ctx, "GET", p.config.ProbeURL, nil)
	if err != nil {
		return false
	}

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()

	// 读取并丢弃响应体，确保连接可被复用
	io.Copy(io.Discard, resp.Body)

	// 200 或 204 都算成功
	return resp.StatusCode == 200 || resp.StatusCode == 204
}

// updateResult 更新探测结果
func (p *Prober) updateResult(tag string, latency int64, success bool) {
	resultVal, ok := p.results.Load(tag)
	if !ok {
		return
	}
	result := resultVal.(*ProbeResult)

	// 获取历史记录
	historyVal, ok := p.history.Load(tag)
	if !ok {
		// 节点可能已被删除
		return
	}
	history := historyVal.(*nodeHistory)

	// 线程安全地更新历史记录并获取成功率
	successRate := history.update(success)

	// 创建新的结果对象 (避免直接修改)
	newResult := &ProbeResult{
		NodeTag:     result.NodeTag,
		Protocol:    result.Protocol,
		Address:     result.Address,
		Port:        result.Port,
		Latency:     latency,
		LastProbe:   time.Now(),
		SuccessRate: successRate,
	}

	if success {
		newResult.Status = "online"
		newResult.FailCount = 0
	} else {
		newResult.FailCount = result.FailCount + 1
		if newResult.FailCount >= 3 {
			newResult.Status = "offline"
		} else {
			newResult.Status = "timeout"
		}
	}

	p.results.Store(tag, newResult)
}

// GetStats 获取探测器统计信息
func (p *Prober) GetStats() map[string]interface{} {
	var totalNodes, onlineNodes, offlineNodes, timeoutNodes int

	p.results.Range(func(key, value interface{}) bool {
		result := value.(*ProbeResult)
		totalNodes++
		switch result.Status {
		case "online":
			onlineNodes++
		case "offline":
			offlineNodes++
		case "timeout":
			timeoutNodes++
		}
		return true
	})

	return map[string]interface{}{
		"running":      p.IsRunning(),
		"totalNodes":   totalNodes,
		"onlineNodes":  onlineNodes,
		"offlineNodes": offlineNodes,
		"timeoutNodes": timeoutNodes,
		"config": map[string]interface{}{
			"probeInterval": p.config.ProbeInterval.String(),
			"probeTimeout":  p.config.ProbeTimeout.String(),
			"maxRetries":    p.config.MaxRetries,
			"maxConcurrent": p.config.MaxConcurrent,
		},
	}
}

// SaveNodesToFile 保存节点配置到文件
func (p *Prober) SaveNodesToFile() error {
	var nodes []ProbeNode
	p.nodes.Range(func(key, value interface{}) bool {
		nodes = append(nodes, value.(ProbeNode))
		return true
	})

	data, err := json.MarshalIndent(nodes, "", "  ")
	if err != nil {
		return err
	}

	filePath := filepath.Join(singboxDir, "prober_nodes.json")
	return os.WriteFile(filePath, data, 0644)
}

// LoadNodesFromFile 从文件加载节点配置
func (p *Prober) LoadNodesFromFile() error {
	filePath := filepath.Join(singboxDir, "prober_nodes.json")

	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil // 文件不存在不是错误
		}
		return err
	}

	var nodes []ProbeNode
	if err := json.Unmarshal(data, &nodes); err != nil {
		return err
	}

	p.UpdateNodes(nodes)
	return nil
}

// StopProber 停止全局探测器
func StopProber() {
	proberMutex.Lock()
	defer proberMutex.Unlock()

	if globalProber != nil {
		globalProber.Stop()
		globalProber = nil
	}
}
