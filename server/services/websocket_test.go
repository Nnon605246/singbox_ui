package services

import (
	"encoding/json"
	"sync"
	"testing"
	"time"
)

func TestWSHubSingleton(t *testing.T) {
	hub1 := GetWSHub()
	hub2 := GetWSHub()

	if hub1 != hub2 {
		t.Error("GetWSHub should return the same instance")
	}
}

func TestWSHubBroadcast(t *testing.T) {
	hub := GetWSHub()

	// 初始状态应该没有客户端
	if hub.ClientCount() != 0 {
		t.Logf("Warning: Hub has %d existing clients", hub.ClientCount())
	}
}

func TestWSMessage(t *testing.T) {
	msg := WSMessage{
		Type:      WSMsgTypeLogs,
		Data:      WSLogData{Line: "test log", Stream: "stdout"},
		Timestamp: time.Now().UnixMilli(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		t.Fatalf("Failed to marshal WSMessage: %v", err)
	}

	var parsed WSMessage
	if err := json.Unmarshal(data, &parsed); err != nil {
		t.Fatalf("Failed to unmarshal WSMessage: %v", err)
	}

	if parsed.Type != WSMsgTypeLogs {
		t.Errorf("Expected type %s, got %s", WSMsgTypeLogs, parsed.Type)
	}
}

func TestWSHubHasSubscribers(t *testing.T) {
	hub := GetWSHub()

	// 没有客户端时应该返回 false
	if hub.HasSubscribers(WSMsgTypeLogs) {
		t.Error("HasSubscribers should return false when no clients connected")
	}
}

func TestWSLogStreamControl(t *testing.T) {
	hub := GetWSHub()

	// 启动日志流
	hub.StartLogStream()

	// 再次启动不应 panic（应该先停止再启动）
	hub.StartLogStream()

	// 停止日志流
	hub.StopLogStream()

	// 再次停止不应 panic
	hub.StopLogStream()
}

func TestWSProberBroadcastControl(t *testing.T) {
	hub := GetWSHub()

	// 启动探测广播
	hub.StartProberBroadcast()

	// 再次启动不应 panic
	hub.StartProberBroadcast()

	// 停止广播
	hub.StopProberBroadcast()

	// 再次停止不应 panic
	hub.StopProberBroadcast()
}

func TestWSClientSubscription(t *testing.T) {
	client := &WSClient{
		subscribed: make(map[string]bool),
	}

	// 订阅
	client.mu.Lock()
	client.subscribed[WSMsgTypeLogs] = true
	client.subscribed[WSMsgTypeProberResult] = true
	client.mu.Unlock()

	// 验证订阅
	client.mu.RLock()
	if !client.subscribed[WSMsgTypeLogs] {
		t.Error("Client should be subscribed to logs")
	}
	if !client.subscribed[WSMsgTypeProberResult] {
		t.Error("Client should be subscribed to prober_result")
	}
	client.mu.RUnlock()

	// 取消订阅
	client.mu.Lock()
	delete(client.subscribed, WSMsgTypeLogs)
	client.mu.Unlock()

	// 验证取消订阅
	client.mu.RLock()
	if client.subscribed[WSMsgTypeLogs] {
		t.Error("Client should not be subscribed to logs after unsubscribe")
	}
	client.mu.RUnlock()
}

func TestWSHubConcurrentAccess(t *testing.T) {
	hub := GetWSHub()

	var wg sync.WaitGroup

	// 并发广播
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			hub.BroadcastMessage(WSMsgTypeStatus, map[string]int{"value": i})
		}(i)
	}

	// 并发检查订阅者
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			hub.HasSubscribers(WSMsgTypeLogs)
			hub.HasSubscribers(WSMsgTypeProberResult)
		}()
	}

	// 并发获取客户端数量
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			hub.ClientCount()
		}()
	}

	wg.Wait()
	t.Log("Concurrent access test passed")
}

func TestWSMsgTypes(t *testing.T) {
	// 验证消息类型常量
	types := []string{
		WSMsgTypeLogs,
		WSMsgTypeProberResult,
		WSMsgTypeStatus,
		WSMsgTypePing,
		WSMsgTypePong,
		WSMsgTypeError,
	}

	seen := make(map[string]bool)
	for _, typ := range types {
		if seen[typ] {
			t.Errorf("Duplicate message type: %s", typ)
		}
		seen[typ] = true
	}
}
