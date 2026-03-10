package handlers

import (
	"net"
	"net/http"
	"singbox-config-service/services"

	"github.com/gin-gonic/gin"
)

// GenerateWireGuardKeys 生成 WireGuard 密钥对
// @Summary 生成 WireGuard 密钥对
// @Description 生成一对 WireGuard 私钥和公钥，必须指定IP地址
// @Tags WireGuard
// @Accept json
// @Produce json
// @Param request body object{ip:string} true "请求参数，必须包含IP地址"
// @Success 200 {object} services.KeyCacheResponse
// @Failure 400 {object} ErrorResponse "未指定IP地址"
// @Failure 500 {object} ErrorResponse "IP已存在或生成失败"
// @Router /api/wireguard/keygen [post]
func GenerateWireGuardKeys(c *gin.Context) {
	var request struct {
		IP string `json:"ip"` // 必须指定的完整IP，如 "10.10.0.5"
	}

	if err := c.ShouldBindJSON(&request); err != nil || request.IP == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "IP address is required",
		})
		return
	}

	if net.ParseIP(request.IP) == nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid IP format",
			Message: "Please provide a valid IPv4 or IPv6 address",
		})
		return
	}

	// 使用缓存生成密钥对
	result, err := services.GenerateWireGuardKeysWithCache(request.IP)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to generate WireGuard keys",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ErrorResponse 错误响应
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// SaveClientConfig 保存客户端配置
func SaveClientConfig(c *gin.Context) {
	configData, err := c.GetRawData()
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Failed to read config data",
			Message: err.Error(),
		})
		return
	}

	err = services.SaveClientConfig(configData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to save client config",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Client config saved successfully",
	})
}

// GetClientConfig 获取客户端配置
func GetClientConfig(c *gin.Context) {
	data, err := services.GetClientConfig()
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Client config not found",
			Message: err.Error(),
		})
		return
	}

	c.Data(http.StatusOK, "application/json", data)
}

// GetPublicKeyFromPrivate 从私钥计算公钥
func GetPublicKeyFromPrivate(c *gin.Context) {
	var request struct {
		PrivateKey string `json:"privateKey"`
	}

	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: err.Error(),
		})
		return
	}

	publicKey, err := services.GeneratePublicKeyFromPrivate(request.PrivateKey)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Failed to generate public key",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"publicKey": publicKey,
	})
}

// SaveClientConfigFile 保存客户端配置文件
func SaveClientConfigFile(c *gin.Context) {
	var request struct {
		ClientIndex   int    `json:"clientIndex"`
		ConfigContent string `json:"configContent"`
	}

	if err := c.BindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: err.Error(),
		})
		return
	}

	err := services.SaveClientConfigFile(request.ClientIndex, request.ConfigContent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to save client config file",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Client config file saved successfully",
	})
}

// ListClientConfigFiles 列出所有客户端配置文件
func ListClientConfigFiles(c *gin.Context) {
	configs, err := services.ListClientConfigFiles()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to list client config files",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, configs)
}

// HealthCheck 健康检查
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "Sing-box Config Service is running",
	})
}

// GetKeysCache 获取密钥缓存列表
func GetKeysCache(c *gin.Context) {
	cache, err := services.GetKeysCache()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get keys cache",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, cache)
}

// GetPublicIP 获取服务器公网 IP 地址
func GetPublicIP(c *gin.Context) {
	ip, err := services.GetPublicIP()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Failed to get public IP",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"ip": ip,
	})
}
