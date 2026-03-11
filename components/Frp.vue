<template>
  <div class="frp-container">
    <!-- 配置面板 -->
    <div class="config-panel">
      <div class="config-header" @click="showConfig = !showConfig">
        <span>{{ showConfig ? '▼' : '▶' }} API配置</span>
      </div>
      
      <div v-if="showConfig" class="config-content">
        <div class="input-group">
          <label>API地址：</label>
          <input v-model="apiUrl" placeholder="例如：https://frp.geekery.cn" />
        </div>
        
        <div class="input-group">
          <label>用户名：</label>
          <input v-model="username" placeholder="输入用户名" />
        </div>
        
        <div class="input-group">
          <label>密码：</label>
          <div class="password-input-wrapper">
            <input 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="输入密码" 
            />
            <button 
              @click="showPassword = !showPassword" 
              class="toggle-password"
              type="button"
            >
              {{ showPassword ? '👁️' : '👁️‍🗨️' }}
            </button>
          </div>
        </div>
        
        <div class="btn-row">
          <button @click="saveConfig" class="btn-save">保存配置</button>
          <button @click="fetchData" class="btn-refresh">刷新数据</button>
        </div>
      </div>
    </div>

    <!-- 数据表格 -->
    <table class="frp-table">
      <thead>
        <tr>
          <th>服务名称</th>
          <th>协议类型</th>
          <th>远程端口</th>
          <th>流量统计</th>
          <th>当前连接</th>
          <th>状态</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="proxy in proxies" :key="proxy.name">
          <td>{{ proxy.name }}</td>
          <td>{{ proxy.conf.type }}</td>
          <td>{{ proxy.conf.remotePort }}</td>
          <td>
            <div>入：{{ formatTraffic(proxy.todayTrafficIn) }}</div>
            <div>出：{{ formatTraffic(proxy.todayTrafficOut) }}</div>
          </td>
          <td>{{ proxy.curConns }}</td>
          <td>
            <div :class="['status-tag', proxy.status]">
              {{ proxy.status === 'online' ? '在线' : '离线' }}
            </div>
          </td>
        </tr>
        <tr v-if="proxies.length === 0 && !loading">
          <td colspan="6" class="empty-data">
            {{ errorMessage || '暂无数据，请配置API地址后刷新' }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="loading" class="loading-overlay">
      <div class="loader"></div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loading: false,
      proxies: [],
      showConfig: false,
      apiUrl: 'https://frp.geekery.cn',
      username: 'admin',
      password: '',
      errorMessage: '',
      showPassword: false
    }
  },
  methods: {
    async fetchData() {
      if (!this.apiUrl) {
        this.errorMessage = '请先配置API地址'
        return
      }

      this.loading = true
      this.errorMessage = ''

      try {
        const auth = btoa(`${this.username}:${this.password}`)
        
        // 移除URL末尾的斜杠，避免双斜杠
        const baseUrl = this.apiUrl.replace(/\/$/, '')
        
        const response = await fetch(`${baseUrl}/api/proxy/tcp`, {
          headers: {
            Authorization: `Basic ${auth}`
          },
          mode: 'cors'
        })

        if (!response.ok) {
          throw new Error(`HTTP错误! 状态码: ${response.status}`)
        }

        const data = await response.json()
        this.proxies = data.proxies || []
      } catch (error) {
        console.error('API请求失败:', error)
        
        // 判断是否是CORS错误
        if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
          this.errorMessage = `跨域请求失败：FRP Dashboard不允许跨域访问。
          
解决方案：
1. 使用浏览器扩展（如CORS Unblock）临时解决
2. 配置FRP Dashboard允许CORS
3. 使用反向代理（推荐）`
        } else {
          this.errorMessage = `数据加载失败: ${error.message}`
        }
        
        this.proxies = []
      } finally {
        this.loading = false
      }
    },
    formatTraffic(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    },
    saveConfig() {
      if (typeof window !== 'undefined') {
        localStorage.setItem('frp-config', JSON.stringify({
          apiUrl: this.apiUrl,
          username: this.username,
          password: this.password
        }))
        alert('配置已保存')
        this.fetchData()
      }
    },
    loadConfig() {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('frp-config')
        if (stored) {
          try {
            const config = JSON.parse(stored)
            this.apiUrl = config.apiUrl || ''
            this.username = config.username || ''
            this.password = config.password || ''
          } catch (e) {
            console.error('加载配置失败:', e)
          }
        }
      }
    }
  },
  mounted() {
    this.loadConfig()
    if (this.apiUrl) {
      this.fetchData()
    } else {
      this.showConfig = true
    }
  }
}
</script>

<style scoped>
.frp-container {
  padding: 20px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
  position: relative;
}

.config-panel {
  margin-bottom: 20px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #f9f9f9;
}

.config-header {
  padding: 10px 15px;
  cursor: pointer;
  user-select: none;
  color: #409eff;
  font-weight: 500;
  font-size: 14px;
}

.config-header:hover {
  background: #f0f0f0;
}

.config-content {
  padding: 15px;
  border-top: 1px solid #e0e0e0;
  background: #fff;
}

.input-group {
  margin-bottom: 12px;
}

.input-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: 500;
  color: #555;
  font-size: 13px;
}

.input-group input {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
}

.password-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input-wrapper input {
  flex: 1;
  padding-right: 40px;
}

.toggle-password {
  position: absolute;
  right: 5px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 18px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.6;
  transition: opacity 0.2s;
}

.toggle-password:hover {
  opacity: 1;
}

.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.btn-save,
.btn-refresh {
  flex: 1;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.btn-save {
  background: #42b983;
  color: white;
}

.btn-save:hover {
  background: #3aa876;
}

.btn-refresh {
  background: #409eff;
  color: white;
}

.btn-refresh:hover {
  background: #66b1ff;
}

.frp-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #ebeef5;
  font-size: 13px;
}

.frp-table th,
.frp-table td {
  padding: 10px;
  border: 1px solid #ebeef5;
  text-align: left;
}

.frp-table th {
  background-color: #f5f7fa;
  color: #303133;
  font-weight: 600;
}

.status-tag {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.status-tag.online {
  background-color: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.status-tag.offline {
  background-color: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.empty-data {
  text-align: center;
  color: #909399;
  padding: 20px 0;
  white-space: pre-line;
  line-height: 1.6;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #409eff;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
