<template>
  <div class="qrcode-generator">
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
          <label>码版本</label>
          <select v-model.number="qrVersion">
            <option :value="0">自动选择</option>
            <option :value="1">版本1 (21x21)</option>
            <option :value="2">版本2 (25x25)</option>
            <option :value="3">版本3 (29x29)</option>
            <option :value="4">版本4 (33x33)</option>
            <option :value="5">版本5 (37x37)</option>
            <option :value="6">版本6 (41x41)</option>
            <option :value="7">版本7 (45x45)</option>
            <option :value="8">版本8 (49x49)</option>
            <option :value="9">版本9 (53x53)</option>
            <option :value="10">版本10 (57x57)</option>
          </select>
        </div>
        
        <div class="setting-item">
          <label>码尺寸</label>
          <select v-model.number="qrPhysicalSize">
            <option :value="20">20mm</option>
            <option :value="30">30mm</option>
            <option :value="45">45mm</option>
            <option :value="65">65mm</option>
          </select>
        </div>
        
        <div class="setting-item">
          <label>编码模式</label>
          <select v-model="qrMode">
            <option value="Byte">Byte (通用)</option>
            <option value="Numeric">Numeric (纯数字)</option>
            <option value="Alphanumeric">Alphanumeric (字母数字)</option>
          </select>
        </div>
        
        <div class="setting-item">
          <label>输出格式</label>
          <select v-model="outputFormat">
            <option value="png">PNG (位图)</option>
            <option value="svg">SVG (矢量)</option>
          </select>
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
        <button @click="generateQRCodes" class="btn-generate" :disabled="isGenerating">
          {{ isGenerating ? '生成中...' : '生成二维码' }}
        </button>
        <button @click="downloadAllAsZip" class="btn-download" :disabled="qrCodes.length === 0 || isGenerating">
          下载压缩包 ({{ qrCodes.length }})
        </button>
        <button @click="clearAll" class="btn-clear" :disabled="isGenerating">清空</button>
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
import { zipSync, strToU8 } from 'fflate'

export default {
  data() {
    return {
      inputText: 'www.geekery.cn,运维开发绿皮书\nwww.google.com,Google',
      qrSize: 300,
      qrVersion: 0, // 0表示自动选择
      qrPhysicalSize: 30, // 物理尺寸（毫米）
      qrMode: 'Byte', // 编码模式
      foregroundColor: '#000000',
      backgroundColor: '#ffffff',
      errorLevel: 'M',
      outputFormat: 'png', // 输出格式：png 或 svg
      qrCodes: [],
      canvasRefs: [],
      errorMessage: '',
      isGenerating: false
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
      this.isGenerating = true
      
      if (!this.inputText.trim()) {
        this.errorMessage = '请输入要生成的数据'
        this.isGenerating = false
        return
      }
      
      const lines = this.inputText.trim().split('\n').filter(line => line.trim())
      
      if (lines.length === 0) {
        this.errorMessage = '没有有效的数据'
        this.isGenerating = false
        return
      }
      
      // 生成一个随机种子，用于本次批量生成
      const batchSeed = Date.now()
      
      lines.forEach((line, idx) => {
        const parts = line.split(',')
        const content = parts[0]?.trim()
        const label = parts[1]?.trim() || '未命名'
        
        if (content) {
          this.qrCodes.push({
            content,
            label,
            seed: batchSeed + idx // 每个二维码有唯一的种子
          })
        }
      })
      
      // 等待DOM更新后生成二维码
      this.$nextTick(() => {
        this.qrCodes.forEach((item, index) => {
          this.drawQRCode(item.content, item.label, item.seed, index)
        })
        this.isGenerating = false
      })
    },
    
    drawQRCode(text, label, seed, index) {
      const canvas = this.canvasRefs[index]
      if (!canvas) return
      
      try {
        // 创建二维码对象，使用用户选择的版本或自动选择
        const qr = qrcode(this.qrVersion, this.errorLevel)
        // 在内容末尾添加不可见字符（零宽空格）+ 随机种子来改变掩码
        const invisibleChars = '\u200B'.repeat(seed % 10)
        
        // 根据编码模式添加数据
        try {
          qr.addData(text + invisibleChars, this.qrMode)
        } catch (e) {
          // 如果指定模式失败，回退到Byte模式
          console.warn(`编码模式 ${this.qrMode} 失败，回退到 Byte 模式`)
          qr.addData(text + invisibleChars, 'Byte')
        }
        
        qr.make()
        
        // 如果是SVG格式，使用SVG渲染
        if (this.outputFormat === 'svg') {
          this.drawQRCodeSVG(qr, label, canvas, index)
        } else {
          this.drawQRCodeCanvas(qr, label, canvas, index)
        }
        
      } catch (error) {
        console.error('生成二维码失败:', error)
        this.errorMessage = `生成第 ${index + 1} 个二维码失败: ${error.message}`
      }
    },
    
    drawQRCodeCanvas(qr, label, canvas, index) {
      // 获取二维码模块数量
      const moduleCount = qr.getModuleCount()
      
      // 根据物理尺寸计算像素大小
      const dpi = 300
      const mmToInch = 25.4
      const physicalSizeInch = this.qrPhysicalSize / mmToInch
      const pixelSize = Math.round(physicalSizeInch * dpi)
      
      // 计算每个模块的像素大小
      const cellSize = Math.max(1, Math.floor(pixelSize / moduleCount))
      const qrCodeSize = cellSize * moduleCount
      const padding = Math.max(10, Math.floor(qrCodeSize * 0.05))
      const labelHeight = Math.max(30, Math.floor(qrCodeSize * 0.15))
      
      // 设置canvas大小
      const canvasWidth = qrCodeSize + padding * 2
      const canvasHeight = qrCodeSize + padding * 2 + labelHeight
      
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      
      const ctx = canvas.getContext('2d')
      
      // 绘制背景
      ctx.fillStyle = this.backgroundColor
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
      
      // 绘制二维码
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
      
      // 绘制标签
      ctx.fillStyle = '#333333'
      const fontSize = Math.max(12, Math.floor(qrCodeSize * 0.04))
      ctx.font = `${fontSize}px Arial, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      
      const maxWidth = canvasWidth - padding * 2
      const y = qrCodeSize + padding * 2 + labelHeight / 2
      
      if (ctx.measureText(label).width > maxWidth) {
        let truncated = label
        while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
          truncated = truncated.slice(0, -1)
        }
        ctx.fillText(truncated + '...', canvasWidth / 2, y)
      } else {
        ctx.fillText(label, canvasWidth / 2, y)
      }
    },
    
    drawQRCodeSVG(qr, label, canvas, index) {
      // SVG格式：创建SVG字符串并转换为图片显示在canvas上
      const moduleCount = qr.getModuleCount()
      const cellSize = 10
      const qrCodeSize = cellSize * moduleCount
      const padding = Math.max(10, Math.floor(qrCodeSize * 0.05))
      const labelHeight = Math.max(30, Math.floor(qrCodeSize * 0.15))
      
      const canvasWidth = qrCodeSize + padding * 2
      const canvasHeight = qrCodeSize + padding * 2 + labelHeight
      
      // 创建SVG字符串
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}">`
      
      // 背景
      svg += `<rect width="${canvasWidth}" height="${canvasHeight}" fill="${this.backgroundColor}"/>`
      
      // 二维码模块
      for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
          if (qr.isDark(row, col)) {
            const x = padding + col * cellSize
            const y = padding + row * cellSize
            svg += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${this.foregroundColor}"/>`
          }
        }
      }
      
      // 标签文字
      const fontSize = Math.max(12, Math.floor(qrCodeSize * 0.04))
      const textY = qrCodeSize + padding * 2 + labelHeight / 2
      svg += `<text x="${canvasWidth / 2}" y="${textY}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="#333333" text-anchor="middle" dominant-baseline="middle">${this.escapeXml(label)}</text>`
      
      svg += '</svg>'
      
      // 将SVG转换为图片显示在canvas上
      const img = new Image()
      const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      img.onload = () => {
        canvas.width = canvasWidth
        canvas.height = canvasHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
        
        // 保存SVG数据供下载使用
        this.qrCodes[index].svgData = svg
      }
      
      img.src = url
    },
    
    escapeXml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    },
    
    downloadSingle(index) {
      const canvas = this.canvasRefs[index]
      const item = this.qrCodes[index]
      
      if (!canvas) return
      
      // 如果是SVG格式且有SVG数据，直接下载SVG
      if (this.outputFormat === 'svg' && item.svgData) {
        const blob = new Blob([item.svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${item.label}.svg`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        // PNG格式
        canvas.toBlob(blob => {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${item.label}.png`
          a.click()
          URL.revokeObjectURL(url)
        })
      }
    },
    
    async downloadAllAsZip() {
      if (this.qrCodes.length === 0) return
      
      try {
        const files = {}
        const fileExt = this.outputFormat === 'svg' ? 'svg' : 'png'
        
        // 将所有文件添加到files对象
        for (let i = 0; i < this.qrCodes.length; i++) {
          const canvas = this.canvasRefs[i]
          const item = this.qrCodes[i]
          
          if (canvas) {
            const filename = `${item.label}.${fileExt}`
            
            if (this.outputFormat === 'svg' && item.svgData) {
              // SVG格式：直接使用SVG字符串
              files[filename] = strToU8(item.svgData)
            } else {
              // PNG格式：转换canvas为Uint8Array
              const blob = await new Promise(resolve => {
                canvas.toBlob(resolve)
              })
              
              const arrayBuffer = await blob.arrayBuffer()
              files[filename] = new Uint8Array(arrayBuffer)
            }
          }
        }
        
        // 使用fflate生成zip
        const zipped = zipSync(files, {
          level: 6 // 压缩级别 0-9
        })
        
        // 创建blob并下载
        const zipBlob = new Blob([zipped], { type: 'application/zip' })
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
  padding: 0;
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
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
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
