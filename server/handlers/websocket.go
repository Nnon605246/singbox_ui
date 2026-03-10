package handlers

import (
	"net/http"
	"singbox-config-service/services"

	"github.com/gin-gonic/gin"
)

// WebSocketHandler 处理 WebSocket 连接
func WebSocketHandler(c *gin.Context) {
	services.ServeWS(c.Writer, c.Request)
}

// GetWebSocketStatus 获取 WebSocket 状态
func GetWebSocketStatus(c *gin.Context) {
	hub := services.GetWSHub()

	c.JSON(http.StatusOK, gin.H{
		"connected_clients": hub.ClientCount(),
		"log_streaming":     hub.HasSubscribers(services.WSMsgTypeLogs),
		"prober_streaming":  hub.HasSubscribers(services.WSMsgTypeProberResult),
	})
}
