package services

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestNewProber(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	if prober == nil {
		t.Fatal("NewProber returned nil")
	}

	if prober.config.ProbeInterval != 30*time.Second {
		t.Errorf("Expected ProbeInterval 30s, got %v", prober.config.ProbeInterval)
	}

	if prober.config.ProbeTimeout != 5*time.Second {
		t.Errorf("Expected ProbeTimeout 5s, got %v", prober.config.ProbeTimeout)
	}

	// 验证 context 已创建
	if prober.ctx == nil {
		t.Error("Context should not be nil")
	}
	if prober.cancel == nil {
		t.Error("Cancel func should not be nil")
	}
}

func TestProberAddRemoveNode(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	// 添加节点
	node := ProbeNode{
		Tag:      "test-node-1",
		Protocol: "vmess",
		Address:  "127.0.0.1",
		Port:     10086,
	}
	prober.AddNode(node)

	// 验证节点已添加
	result := prober.GetResult("test-node-1")
	if result == nil {
		t.Fatal("Node not found after adding")
	}

	if result.NodeTag != "test-node-1" {
		t.Errorf("Expected tag 'test-node-1', got '%s'", result.NodeTag)
	}

	if result.Status != "unknown" {
		t.Errorf("Expected status 'unknown', got '%s'", result.Status)
	}

	// 移除节点
	prober.RemoveNode("test-node-1")

	result = prober.GetResult("test-node-1")
	if result != nil {
		t.Error("Node should not exist after removal")
	}
}

func TestProberUpdateNodes(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	// 批量添加节点
	nodes := []ProbeNode{
		{Tag: "node-1", Protocol: "vmess", Address: "1.1.1.1", Port: 443},
		{Tag: "node-2", Protocol: "vless", Address: "2.2.2.2", Port: 443},
		{Tag: "node-3", Protocol: "trojan", Address: "3.3.3.3", Port: 443},
	}

	prober.UpdateNodes(nodes)

	results := prober.GetAllResults()
	if len(results) != 3 {
		t.Errorf("Expected 3 nodes, got %d", len(results))
	}

	// 验证每个节点
	for _, node := range nodes {
		result := prober.GetResult(node.Tag)
		if result == nil {
			t.Errorf("Node %s not found", node.Tag)
		}
	}

	// 更新为新节点集（应清除旧节点）
	newNodes := []ProbeNode{
		{Tag: "new-node-1", Protocol: "ss", Address: "4.4.4.4", Port: 8388},
	}
	prober.UpdateNodes(newNodes)

	results = prober.GetAllResults()
	if len(results) != 1 {
		t.Errorf("Expected 1 node after update, got %d", len(results))
	}

	// 旧节点应该不存在
	if prober.GetResult("node-1") != nil {
		t.Error("Old node should not exist after update")
	}
}

func TestProberClearNodes(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	// 添加节点
	nodes := []ProbeNode{
		{Tag: "node-1", Protocol: "vmess", Address: "1.1.1.1", Port: 443},
		{Tag: "node-2", Protocol: "vless", Address: "2.2.2.2", Port: 443},
	}
	prober.UpdateNodes(nodes)

	// 清空
	prober.ClearNodes()

	results := prober.GetAllResults()
	if len(results) != 0 {
		t.Errorf("Expected 0 nodes after clear, got %d", len(results))
	}
}

func TestProberStartStop(t *testing.T) {
	config := DefaultProberConfig()
	config.ProbeInterval = 100 * time.Millisecond // 快速测试
	prober := NewProber(config)

	// 验证初始状态
	if prober.IsRunning() {
		t.Error("Prober should not be running initially")
	}

	// 验证 running 是 int32 类型（原子操作）
	if atomic.LoadInt32(&prober.running) != 0 {
		t.Error("Initial running state should be 0")
	}

	// 启动
	prober.Start()

	if !prober.IsRunning() {
		t.Error("Prober should be running after Start()")
	}

	// 重复启动应该无效
	prober.Start()
	if !prober.IsRunning() {
		t.Error("Prober should still be running")
	}

	// 停止
	prober.Stop()

	if prober.IsRunning() {
		t.Error("Prober should not be running after Stop()")
	}

	// 重复停止应该无效
	prober.Stop()
	if prober.IsRunning() {
		t.Error("Prober should still be stopped")
	}
}

func TestProberStartStopRace(t *testing.T) {
	config := DefaultProberConfig()
	config.ProbeInterval = 50 * time.Millisecond
	prober := NewProber(config)

	// 并发启动和停止
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(2)
		go func() {
			defer wg.Done()
			prober.Start()
		}()
		go func() {
			defer wg.Done()
			time.Sleep(10 * time.Millisecond)
			prober.Stop()
		}()
	}
	wg.Wait()

	// 确保最终状态一致
	prober.Stop() // 确保停止
}

func TestProberTCPProbe(t *testing.T) {
	config := DefaultProberConfig()
	config.ProbeTimeout = 2 * time.Second
	prober := NewProber(config)

	// 测试可达地址 (Google DNS)
	success := prober.tcpProbe("8.8.8.8", 53)
	if !success {
		t.Log("Warning: TCP probe to 8.8.8.8:53 failed (may be network issue)")
	}

	// 测试不可达地址
	success = prober.tcpProbe("192.0.2.1", 12345) // 文档保留地址
	if success {
		t.Error("TCP probe to unreachable address should fail")
	}
}

func TestProberGetBestNode(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	// 添加节点并模拟结果
	prober.AddNode(ProbeNode{Tag: "slow", Protocol: "vmess", Address: "1.1.1.1", Port: 443})
	prober.AddNode(ProbeNode{Tag: "fast", Protocol: "vmess", Address: "2.2.2.2", Port: 443})
	prober.AddNode(ProbeNode{Tag: "offline", Protocol: "vmess", Address: "3.3.3.3", Port: 443})

	// 手动设置结果
	prober.results.Store("slow", &ProbeResult{
		NodeTag: "slow",
		Latency: 200,
		Status:  "online",
	})
	prober.results.Store("fast", &ProbeResult{
		NodeTag: "fast",
		Latency: 50,
		Status:  "online",
	})
	prober.results.Store("offline", &ProbeResult{
		NodeTag: "offline",
		Latency: -1,
		Status:  "offline",
	})

	best := prober.GetBestNode()
	if best == nil {
		t.Fatal("GetBestNode returned nil")
	}

	if best.NodeTag != "fast" {
		t.Errorf("Expected best node 'fast', got '%s'", best.NodeTag)
	}
}

func TestProberGetOnlineNodes(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	// 添加节点并模拟结果
	prober.AddNode(ProbeNode{Tag: "online-1", Protocol: "vmess", Address: "1.1.1.1", Port: 443})
	prober.AddNode(ProbeNode{Tag: "online-2", Protocol: "vmess", Address: "2.2.2.2", Port: 443})
	prober.AddNode(ProbeNode{Tag: "offline", Protocol: "vmess", Address: "3.3.3.3", Port: 443})

	prober.results.Store("online-1", &ProbeResult{NodeTag: "online-1", Status: "online"})
	prober.results.Store("online-2", &ProbeResult{NodeTag: "online-2", Status: "online"})
	prober.results.Store("offline", &ProbeResult{NodeTag: "offline", Status: "offline"})

	online := prober.GetOnlineNodes()
	if len(online) != 2 {
		t.Errorf("Expected 2 online nodes, got %d", len(online))
	}
}

func TestProberConcurrentAccess(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	// 并发添加节点
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			prober.AddNode(ProbeNode{
				Tag:      "node-" + string(rune('0'+i%10)) + string(rune('0'+i/10)),
				Protocol: "vmess",
				Address:  "1.1.1.1",
				Port:     10000 + i,
			})
		}(i)
	}
	wg.Wait()

	// 并发读取
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			prober.GetAllResults()
			prober.GetBestNode()
			prober.GetOnlineNodes()
		}()
	}
	wg.Wait()

	// 如果没有 panic，测试通过
	t.Log("Concurrent access test passed")
}

func TestProberStats(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	prober.AddNode(ProbeNode{Tag: "node-1", Protocol: "vmess", Address: "1.1.1.1", Port: 443})
	prober.AddNode(ProbeNode{Tag: "node-2", Protocol: "vmess", Address: "2.2.2.2", Port: 443})
	prober.results.Store("node-1", &ProbeResult{NodeTag: "node-1", Status: "online"})
	prober.results.Store("node-2", &ProbeResult{NodeTag: "node-2", Status: "timeout"})

	stats := prober.GetStats()

	if stats["totalNodes"].(int) != 2 {
		t.Errorf("Expected totalNodes 2, got %v", stats["totalNodes"])
	}

	if stats["onlineNodes"].(int) != 1 {
		t.Errorf("Expected onlineNodes 1, got %v", stats["onlineNodes"])
	}

	if stats["timeoutNodes"].(int) != 1 {
		t.Errorf("Expected timeoutNodes 1, got %v", stats["timeoutNodes"])
	}

	if stats["running"].(bool) != false {
		t.Errorf("Expected running false, got %v", stats["running"])
	}
}

func TestNodeHistoryThreadSafe(t *testing.T) {
	h := &nodeHistory{
		results: make([]bool, 10),
		index:   0,
		size:    10,
	}

	// 并发更新历史记录
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			h.update(i%2 == 0)
		}(i)
	}
	wg.Wait()

	// 如果没有 panic 或数据竞争，测试通过
	t.Log("NodeHistory thread safety test passed")
}

func TestProberUpdateResult(t *testing.T) {
	config := DefaultProberConfig()
	config.HistorySize = 5
	prober := NewProber(config)

	prober.AddNode(ProbeNode{Tag: "test", Protocol: "vmess", Address: "1.1.1.1", Port: 443})

	// 模拟连续成功
	for i := 0; i < 5; i++ {
		prober.updateResult("test", 100, true)
	}

	result := prober.GetResult("test")
	if result.Status != "online" {
		t.Errorf("Expected status 'online', got '%s'", result.Status)
	}
	if result.SuccessRate != 100 {
		t.Errorf("Expected success rate 100, got %v", result.SuccessRate)
	}
	if result.FailCount != 0 {
		t.Errorf("Expected fail count 0, got %d", result.FailCount)
	}

	// 模拟连续失败
	for i := 0; i < 3; i++ {
		prober.updateResult("test", -1, false)
	}

	result = prober.GetResult("test")
	if result.Status != "offline" {
		t.Errorf("Expected status 'offline' after 3 failures, got '%s'", result.Status)
	}
	if result.FailCount != 3 {
		t.Errorf("Expected fail count 3, got %d", result.FailCount)
	}
}

func TestProberUpdateResultDeletedNode(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	prober.AddNode(ProbeNode{Tag: "test", Protocol: "vmess", Address: "1.1.1.1", Port: 443})

	// 删除节点
	prober.RemoveNode("test")

	// 更新已删除的节点不应 panic
	prober.updateResult("test", 100, true)
}

func TestProberResultIsCopy(t *testing.T) {
	config := DefaultProberConfig()
	prober := NewProber(config)

	prober.AddNode(ProbeNode{Tag: "test", Protocol: "vmess", Address: "1.1.1.1", Port: 443})
	prober.results.Store("test", &ProbeResult{
		NodeTag: "test",
		Status:  "online",
		Latency: 100,
	})

	// 获取结果
	result1 := prober.GetResult("test")
	result2 := prober.GetResult("test")

	// 修改 result1
	result1.Latency = 999

	// result2 不应受影响
	if result2.Latency == 999 {
		t.Error("GetResult should return a copy, not the original")
	}
}

func TestProberContextCancellation(t *testing.T) {
	config := DefaultProberConfig()
	config.ProbeInterval = 100 * time.Millisecond
	prober := NewProber(config)

	prober.AddNode(ProbeNode{Tag: "test", Protocol: "vmess", Address: "192.0.2.1", Port: 443})

	prober.Start()

	// 等待一小段时间让探测开始
	time.Sleep(50 * time.Millisecond)

	// 停止探测器
	done := make(chan struct{})
	go func() {
		prober.Stop()
		close(done)
	}()

	// 验证 Stop 不会阻塞太久
	select {
	case <-done:
		// 正常停止
	case <-time.After(3 * time.Second):
		t.Error("Stop should not block for too long")
	}
}
