<template>
  <div class="qrcode-generator">
    <h3>二维码批量生成器</h3>
    
    <div class="input-section">
      <div class="input-group">
        <label>输入数据（每行一个，格式：二维码内容,文件名）</label>
        <textarea
          v-model="inputText"
          placeholder="示例：
https://example.com,网站首页
https://github.com,GitHub
tel:13800138000,联系电话"
          rows="10"
        ></textarea>
        <p class="hint">格式说明：每行一个，用逗号分隔二维码内容和文件名</p>
      </div>
      
      <div class="settings-row">
        <div class="setting-item">
          <label>二维码大小</label>
          <input type="number" v-model.number="qrSize" min="100" max="1000" step="50" />
        </div>
        
        <div class="setting-item">
          <label>前景色</label>
          <input type="color" v-model="foregroundColor" />
        </div>
        
        <div class="setting-item">
          <label>背景色</label>
          <input type="color" v-model="backgroundColor" />
        </div>
        
        <div class="setting-item">
          <label>容错级别</label>
          <select v-model="errorLevel">
            <option value="L">L (7%)</option>
            <option value="M">M (15%)</option>
            <option value="Q">Q (25%)</option>
            <option value="H">H (30%)</option>
          </select>
        </div>
      </div>
      
      <div class="button-row">
        <button @click="generateQRCodes" class="btn-generate">生成二维码</button>
        <button @click="downloadAllAsZip" class="btn-download" :disabled="qrCodes.length === 0">
          下载压缩包 ({{ qrCodes.length }})
        </button>
        <button @click="clearAll" class="btn-clear">清空</button>
      </div>
    </div>
    
    <div v-if="qrCodes.length > 0" class="result-section">
      <h4>生成结果 ({{ qrCodes.length }} 个)</h4>
      <div class="qrcode-grid">
        <div v-for="(item, index) in qrCodes" :key="index" class="qrcode-item">
          <div class="qrcode-wrapper">
            <canvas :ref="el => setCanvasRef(el, index)" class="qrcode-canvas"></canvas>
          </div>
          <button @click="downloadSingle(index)" class="btn-download-single">
            下载
          </button>
        </div>
      </div>
    </div>
    
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script>
import qrcode from 'qrcode-generator'
import JSZip from 'jszip'

export default {
  data() {
    return {
      inputText: 'www.geekery.cn,运维开发绿皮书\nwww.google.com,Google',
      qrSize: 300,
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      errorLevel: 'M',
      qrCodes: [],
      canvasRefs: [],
      errorMessage: ''
    }
  },
  methods: {
    setCanvasRef(el, index) {
      if (el) {
        this.canvasRefs[index] = el
      }
    },
    
    generateQRCodes() {
      this.errorMessage = ''
      this.qrCodes = []
      this.canvasRefs = []
      
      if (!this.inputText.trim()) {
        this.errorMessage = '请输入要生成的数据'
        return
      }
      
      const lines = this.inputText.trim().split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        this.errorMessage = '没有有效的数据'
        return
      }
      
      lines.forEach(line => {
        const parts = line.split(',')
        const content = parts[0]?.trim()
        const label = parts[1]?.trim() || '未命名'
        
        if (content) {
          this.qrCodes.push({
            content,
            label
          })
        }
      })
      
      // 等待DOM更新后生成二维码
      this.$nextTick(() => {
        this.qrCodes.forEach((item, index) => {
          this.drawQRCode(item.content, item.label, index)
        })
      })
    },
    
    drawQRCode(text, label, index) {
      const canvas = this.canvasRefs[index]
      if (!canvas) return
      
      try {
        // 创建二维码对象，使用0让库自动选择合适的版本
        const qr = qrcode(0, this.errorLevel)
        qr.addData(text)
        qr.make()
        
        // 获取二维码模块数量
        const moduleCount = qr.getModuleCount()
        const cellSize = 8 // 每个模块8像素
        const qrCodeSize = cellSize * moduleCount
        const padding = 20
        const labelHeight = 40
        
        // 设置canvas大小（二维码 + 上下padding + 底部标签区域）
        const canvasWidth = qrCodeSize + padding * 2
        const canvasHeight = qrCodeSize + padding * 2 + labelHeight
        
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        
        const ctx = canvas.getContext('2d')
        
        // 绘制白色背景
        ctx.fillStyle = this.backgroundColor
        ctx.fillRect(0, 0, canvasWidth, canvasHeight)
        
        // 绘制二维码（居中，留出上下padding）
        const qrStartX = padding
        const qrStartY = padding
        
        ctx.fillStyle = this.foregroundColor
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              ctx.fillRect(
                qrStartX + col * cellSize,
                qrStartY + row * cellSize,
                cellSize,
                cellSize
              )
            }
          }
        }
        
        // 绘制底部标签文字
        ctx.fillStyle = '#333333'
        ctx.font = '14px Arial, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        
        // 文字换行处理
        const maxWidth = canvasWidth - padding * 2
        const words = label.split('')
        let line = ''
        let y = qrCodeSize + padding * 2 + labelHeight / 2
        
        // 简单的文字截断，如果太长就显示省略号
        if (ctx.measureText(label).width > maxWidth) {
          let truncated = label
          while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1)
          }
          ctx.fillText(truncated + '...', canvasWidth / 2, y)
        } else {
          ctx.fillText(label, canvasWidth / 2, y)
        }
        
      } catch (error) {
        console.error('生成二维码失败:', error)
        this.errorMessage = `生成第 ${index + 1} 个二维码失败: ${error.message}`
      }
    },
    
    downloadSingle(index) {
      const canvas = this.canvasRefs[index]
      const item = this.qrCodes[index]
      
      if (!canvas) return
      
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${item.label}.png`
        a.click()
        URL.revokeObjectURL(url)
      })
    },
    
    async downloadAllAsZip() {
      if (this.qrCodes.length === 0) return
      
      try {
        const zip = new JSZip()
        
        // 将所有canvas转换为blob并添加到zip
        for (let i = 0; i < this.qrCodes.length; i++) {
          const canvas = this.canvasRefs[i]
          const item = this.qrCodes[i]
          
          if (canvas) {
            // 使用Promise包装toBlob
            const blob = await new Promise(resolve => {
              canvas.toBlob(resolve)
            })
            
            // 添加到zip，确保文件名唯一
            const filename = `${item.label}.png`
            zip.file(filename, blob)
          }
        }
        
        // 生成zip文件
        const zipBlob = await zip.generateAsync({ type: 'blob' })
        
        // 下载zip文件
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `二维码批量_${new Date().getTime()}.zip`
        a.click()
        URL.revokeObjectURL(url)
        
      } catch (error) {
        console.error('生成压缩包失败:', error)
        this.errorMessage = '生成压缩包失败: ' + error.message
      }
    },
    
    clearAll() {
      this.inputText = ''
      this.qrCodes = []
      this.canvasRefs = []
      this.errorMessage = ''
    }
  }
}
</script>

<style scoped>
.qrcode-generator {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

h3 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 24px;
}

.input-section {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 30px;
}

.input-group {
  margin-bottom: 20px;
}

.input-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
  font-size: 14px;
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: 'Courier New', monospace;
  box-sizing: border-box;
  resize: vertical;
}

.hint {
  margin: 8px 0 0 0;
  font-size: 12px;
  color: #999;
}

.settings-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 15px;
  margin-bottom: 20px;
}

.setting-item label {
  display: block;
  margin-bottom: 5px;
  font-size: 13px;
  color: #666;
}

.setting-item input,
.setting-item select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  box-sizing: border-box;
}

.button-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

button {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.btn-generate {
  background: #42b983;
  color: white;
}

.btn-generate:hover {
  background: #3aa876;
}

.btn-download {
  background: #409eff;
  color: white;
}

.btn-download:hover:not(:disabled) {
  background: #66b1ff;
}

.btn-download:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-clear {
  background: #f56c6c;
  color: white;
}

.btn-clear:hover {
  background: #e85555;
}

.result-section h4 {
  margin: 0 0 20px 0;
  color: #333;
  font-size: 18px;
}

.qrcode-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.qrcode-item {
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  text-align: center;
}

.qrcode-wrapper {
  margin-bottom: 10px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.qrcode-canvas {
  max-width: 100%;
  height: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.btn-download-single {
  width: 100%;
  padding: 8px;
  background: #409eff;
  color: white;
  font-size: 13px;
}

.btn-download-single:hover {
  background: #66b1ff;
}

.error-message {
  margin-top: 20px;
  padding: 15px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 6px;
  color: #f56c6c;
  font-size: 14px;
}

@media (max-width: 768px) {
  .settings-row {
    grid-template-columns: 1fr;
  }
  
  .qrcode-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
}
</style>
