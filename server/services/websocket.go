package services

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket 消息类型
const (
	WSMsgTypeLogs         = "logs"
	WSMsgTypeProberResult = "prober_result"
	WSMsgTypeStatus       = "status"
	WSMsgTypePing         = "ping"
	WSMsgTypePong         = "pong"
	WSMsgTypeError        = "error"
)

// WSMessage WebSocket 消息结构
type WSMessage struct {
	Type      string      `json:"type"`
	Data      interface{} `json:"data,omitempty"`
	Timestamp int64       `json:"timestamp"`
}

// WSLogData 日志数据
type WSLogData struct {
	Line   string `json:"line"`
	Stream string `json:"stream"` // stdout or stderr
}

// WSClient WebSocket 客户端
type WSClient struct {
	conn       *websocket.Conn
	send       chan []byte
	hub        *WSHub
	subscribed map[string]bool // 订阅的消息类型
	mu         sync.RWMutex
	closed     int32 // atomic: 1 = send channel 已关闭
}

// safeSend 安全地向客户端发送数据，防止向已关闭 channel 写入导致 panic
func (c *WSClient) safeSend(data []byte) bool {
	if atomic.LoadInt32(&c.closed) == 1 {
		return false
	}
	select {
	case c.send <- data:
		return true
	default:
		return false
	}
}

// WSHub WebSocket 连接管理中心
type WSHub struct {
	clients    map[*WSClient]bool
	broadcast  chan []byte
	register   chan *WSClient
	unregister chan *WSClient
	mu         sync.RWMutex

	// 日志流相关
	logCtx    context.Context
	logCancel context.CancelFunc
	logMu     sync.Mutex

	// prober 推送控制
	proberCtx    context.Context
	proberCancel context.CancelFunc
	proberMu     sync.Mutex
}

var (
	wsHub     *WSHub
	wsHubOnce sync.Once

	upgrader = websocket.Upgrader{
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
		CheckOrigin: func(r *http.Request) bool {
			return true // 允许跨域
		},
	}
)

// GetWSHub 获取 WebSocket Hub 单例
func GetWSHub() *WSHub {
	wsHubOnce.Do(func() {
		wsHub = &WSHub{
			clients:    make(map[*WSClient]bool),
			broadcast:  make(chan []byte, 256),
			register:   make(chan *WSClient),
			unregister: make(chan *WSClient),
		}
		go wsHub.run()
	})
	return wsHub
}

// run Hub 主循环
func (h *WSHub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("WebSocket client connected, total: %d", len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				atomic.StoreInt32(&client.closed, 1)
				close(client.send)
			}
			h.mu.Unlock()
			log.Printf("WebSocket client disconnected, total: %d", len(h.clients))

		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				if !client.safeSend(message) {
					// 发送缓冲区满或已关闭，断开连接
					delete(h.clients, client)
					atomic.StoreInt32(&client.closed, 1)
					close(client.send)
				}
			}
			h.mu.Unlock()
		}
	}
}

// BroadcastMessage 广播消息
func (h *WSHub) BroadcastMessage(msgType string, data interface{}) {
	msg := WSMessage{
		Type:      msgType,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal WS message: %v", err)
		return
	}

	select {
	case h.broadcast <- jsonData:
	default:
		log.Println("Broadcast channel full, dropping message")
	}
}

// BroadcastToSubscribers 仅广播给订阅者
func (h *WSHub) BroadcastToSubscribers(msgType string, data interface{}) {
	msg := WSMessage{
		Type:      msgType,
		Data:      data,
		Timestamp: time.Now().UnixMilli(),
	}

	jsonData, err := json.Marshal(msg)
	if err != nil {
		log.Printf("Failed to marshal WS message: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		client.mu.RLock()
		subscribed := client.subscribed[msgType]
		client.mu.RUnlock()

		if subscribed {
			client.safeSend(jsonData)
		}
	}
}

// HasSubscribers 检查是否有订阅者
func (h *WSHub) HasSubscribers(msgType string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.clients {
		client.mu.RLock()
		subscribed := client.subscribed[msgType]
		client.mu.RUnlock()
		if subscribed {
			return true
		}
	}
	return false
}

// ClientCount 返回连接的客户端数量
func (h *WSHub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// StartLogStream 启动日志流推送
func (h *WSHub) StartLogStream() {
	h.logMu.Lock()
	defer h.logMu.Unlock()

	// 如果已经在运行，先停止
	if h.logCancel != nil {
		h.logCancel()
	}

	h.logCtx, h.logCancel = context.WithCancel(context.Background())
	go h.streamLogs(h.logCtx)
}

// StopLogStream 停止日志流推送
func (h *WSHub) StopLogStream() {
	h.logMu.Lock()
	defer h.logMu.Unlock()

	if h.logCancel != nil {
		h.logCancel()
		h.logCancel = nil
	}
}

// streamLogs 从 Docker 容器流式获取日志
func (h *WSHub) streamLogs(ctx context.Context) {
	docker := GetDockerService()
	if docker == nil {
		log.Println("Docker service not available for log streaming")
		return
	}

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		// 检查是否有订阅者
		if !h.HasSubscribers(WSMsgTypeLogs) {
			time.Sleep(1 * time.Second)
			continue
		}

		// 检查容器是否运行
		running, _, err := docker.GetContainerStatus()
		if err != nil || !running {
			time.Sleep(2 * time.Second)
			continue
		}

		// 使用 Docker API 的 follow 模式流式获取日志
		reader, err := docker.FollowContainerLogs(ctx, "10")
		if err != nil {
			log.Printf("Failed to get container logs: %v", err)
			time.Sleep(2 * time.Second)
			continue
		}

		// 读取 Docker 多路复用日志流
		// 格式: [stream_type(1)][0][0][0][size(4 big-endian)][data]
		header := make([]byte, 8)
		for {
			select {
			case <-ctx.Done():
				reader.Close()
				return
			default:
			}

			// 读取 8 字节头部
			_, err := io.ReadFull(reader, header)
			if err != nil {
				if err != io.EOF {
					log.Printf("Log header read error: %v", err)
				}
				break
			}

			// 解析流类型和数据长度
			streamType := header[0]
			size := binary.BigEndian.Uint32(header[4:8])

			if size == 0 || size > 65536 {
				continue // 跳过无效数据
			}

			// 读取日志内容
			data := make([]byte, size)
			_, err = io.ReadFull(reader, data)
			if err != nil {
				break
			}

			stream := "stdout"
			if streamType == 2 {
				stream = "stderr"
			}

			h.BroadcastToSubscribers(WSMsgTypeLogs, WSLogData{
				Line:   string(data),
				Stream: stream,
			})
		}

		reader.Close()

		// 短暂等待后重连
		time.Sleep(1 * time.Second)
	}
}

// StartProberBroadcast 启动 Prober 结果广播
func (h *WSHub) StartProberBroadcast() {
	h.proberMu.Lock()
	defer h.proberMu.Unlock()

	if h.proberCancel != nil {
		h.proberCancel()
	}

	h.proberCtx, h.proberCancel = context.WithCancel(context.Background())
	go h.broadcastProberResults(h.proberCtx)
}

// StopProberBroadcast 停止 Prober 结果广播
func (h *WSHub) StopProberBroadcast() {
	h.proberMu.Lock()
	defer h.proberMu.Unlock()

	if h.proberCancel != nil {
		h.proberCancel()
		h.proberCancel = nil
	}
}

// broadcastProberResults 广播探测结果
func (h *WSHub) broadcastProberResults(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Second) // 每秒推送一次
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if !h.HasSubscribers(WSMsgTypeProberResult) {
				continue
			}

			prober := GetProber()
			if prober == nil || !prober.IsRunning() {
				continue
			}

			results := prober.GetAllResults()
			if len(results) > 0 {
				h.BroadcastToSubscribers(WSMsgTypeProberResult, results)
			}
		}
	}
}

// ServeWS 处理 WebSocket 连接
func ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade failed: %v", err)
		return
	}

	hub := GetWSHub()
	client := &WSClient{
		conn:       conn,
		send:       make(chan []byte, 256),
		hub:        hub,
		subscribed: make(map[string]bool),
	}

	hub.register <- client

	// 启动读写 goroutine
	go client.writePump()
	go client.readPump()
}

// readPump 读取客户端消息
func (c *WSClient) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error: %v", err)
			}
			break
		}

		// 解析消息
		var msg WSMessage
		if err := json.Unmarshal(message, &msg); err != nil {
			continue
		}

		c.handleMessage(&msg)
	}
}

// writePump 发送消息到客户端
func (c *WSClient) writePump() {
	ticker := time.NewTicker(30 * time.Second) // 心跳间隔
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage 处理客户端消息
func (c *WSClient) handleMessage(msg *WSMessage) {
	switch msg.Type {
	case "subscribe":
		// 订阅消息类型
		if topics, ok := msg.Data.([]interface{}); ok {
			c.mu.Lock()
			for _, topic := range topics {
				if t, ok := topic.(string); ok {
					c.subscribed[t] = true
					log.Printf("Client subscribed to: %s", t)
				}
			}
			c.mu.Unlock()

			// 如果订阅了日志，确保日志流已启动
			c.mu.RLock()
			if c.subscribed[WSMsgTypeLogs] {
				c.hub.StartLogStream()
			}
			if c.subscribed[WSMsgTypeProberResult] {
				c.hub.StartProberBroadcast()
			}
			c.mu.RUnlock()
		}

	case "unsubscribe":
		// 取消订阅
		if topics, ok := msg.Data.([]interface{}); ok {
			c.mu.Lock()
			for _, topic := range topics {
				if t, ok := topic.(string); ok {
					delete(c.subscribed, t)
				}
			}
			c.mu.Unlock()
		}

	case WSMsgTypePing:
		// 响应心跳
		response := WSMessage{
			Type:      WSMsgTypePong,
			Timestamp: time.Now().UnixMilli(),
		}
		data, _ := json.Marshal(response)
		c.safeSend(data)
	}
}
