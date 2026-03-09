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
        <button @click="downloadAll" class="btn-download" :disabled="qrCodes.length === 0">
          一键下载全部 ({{ qrCodes.length }})
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
          <div class="qrcode-label">{{ item.label }}</div>
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
          this.drawQRCode(item.content, index)
        })
      })
    },
    
    drawQRCode(text, index) {
      const canvas = this.canvasRefs[index]
      if (!canvas) return
      
      try {
        // 使用简单的二维码生成算法
        const qr = this.createQRCode(text)
        const ctx = canvas.getContext('2d')
        const size = this.qrSize
        const moduleCount = qr.getModuleCount()
        const cellSize = size / moduleCount
        
        canvas.width = size
        canvas.height = size
        
        // 绘制背景
        ctx.fillStyle = this.backgroundColor
        ctx.fillRect(0, 0, size, size)
        
        // 绘制二维码
        ctx.fillStyle = this.foregroundColor
        for (let row = 0; row < moduleCount; row++) {
          for (let col = 0; col < moduleCount; col++) {
            if (qr.isDark(row, col)) {
              ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
            }
          }
        }
      } catch (error) {
        console.error('生成二维码失败:', error)
        this.errorMessage = `生成第 ${index + 1} 个二维码失败: ${error.message}`
      }
    },
    
    createQRCode(text) {
      // 使用qrcode-generator库的简化版本
      const typeNumber = this.getTypeNumber(text.length)
      const qr = new QRCodeModel(typeNumber, this.errorLevel)
      qr.addData(text)
      qr.make()
      return qr
    },
    
    getTypeNumber(length) {
      if (length <= 20) return 1
      if (length <= 38) return 2
      if (length <= 61) return 3
      if (length <= 90) return 4
      if (length <= 122) return 5
      if (length <= 154) return 6
      if (length <= 192) return 7
      if (length <= 230) return 8
      if (length <= 271) return 9
      return 10
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
    
    async downloadAll() {
      if (this.qrCodes.length === 0) return
      
      for (let i = 0; i < this.qrCodes.length; i++) {
        await new Promise(resolve => {
          setTimeout(() => {
            this.downloadSingle(i)
            resolve()
          }, 100 * i) // 延迟下载，避免浏览器阻止
        })
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

// QRCode生成器核心代码（简化版）
class QRCodeModel {
  constructor(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber
    this.errorCorrectLevel = errorCorrectLevel
    this.modules = null
    this.moduleCount = 0
    this.dataCache = null
    this.dataList = []
  }
  
  addData(data) {
    this.dataList.push({ mode: 'Byte', data: data })
    this.dataCache = null
  }
  
  isDark(row, col) {
    if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
      throw new Error(row + ',' + col)
    }
    return this.modules[row][col]
  }
  
  getModuleCount() {
    return this.moduleCount
  }
  
  make() {
    this.makeImpl(false, this.getBestMaskPattern())
  }
  
  makeImpl(test, maskPattern) {
    this.moduleCount = this.typeNumber * 4 + 17
    this.modules = new Array(this.moduleCount)
    
    for (let row = 0; row < this.moduleCount; row++) {
      this.modules[row] = new Array(this.moduleCount)
      for (let col = 0; col < this.moduleCount; col++) {
        this.modules[row][col] = null
      }
    }
    
    this.setupPositionProbePattern(0, 0)
    this.setupPositionProbePattern(this.moduleCount - 7, 0)
    this.setupPositionProbePattern(0, this.moduleCount - 7)
    this.setupPositionAdjustPattern()
    this.setupTimingPattern()
    this.setupTypeInfo(test, maskPattern)
    
    if (this.typeNumber >= 7) {
      this.setupTypeNumber(test)
    }
    
    if (this.dataCache == null) {
      this.dataCache = this.createData(this.typeNumber, this.errorCorrectLevel, this.dataList)
    }
    
    this.mapData(this.dataCache, maskPattern)
  }
  
  setupPositionProbePattern(row, col) {
    for (let r = -1; r <= 7; r++) {
      if (row + r <= -1 || this.moduleCount <= row + r) continue
      
      for (let c = -1; c <= 7; c++) {
        if (col + c <= -1 || this.moduleCount <= col + c) continue
        
        if ((0 <= r && r <= 6 && (c == 0 || c == 6)) ||
            (0 <= c && c <= 6 && (r == 0 || r == 6)) ||
            (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
          this.modules[row + r][col + c] = true
        } else {
          this.modules[row + r][col + c] = false
        }
      }
    }
  }
  
  getBestMaskPattern() {
    let minLostPoint = 0
    let pattern = 0
    
    for (let i = 0; i < 8; i++) {
      this.makeImpl(true, i)
      const lostPoint = this.getLostPoint()
      
      if (i == 0 || minLostPoint > lostPoint) {
        minLostPoint = lostPoint
        pattern = i
      }
    }
    
    return pattern
  }
  
  getLostPoint() {
    let lostPoint = 0
    
    // 横向相同颜色
    for (let row = 0; row < this.moduleCount; row++) {
      for (let col = 0; col < this.moduleCount; col++) {
        let sameCount = 0
        const dark = this.modules[row][col]
        
        for (let r = -1; r <= 1; r++) {
          if (row + r < 0 || this.moduleCount <= row + r) continue
          
          for (let c = -1; c <= 1; c++) {
            if (col + c < 0 || this.moduleCount <= col + c) continue
            if (r == 0 && c == 0) continue
            
            if (dark == this.modules[row + r][col + c]) {
              sameCount++
            }
          }
        }
        
        if (sameCount > 5) {
          lostPoint += (3 + sameCount - 5)
        }
      }
    }
    
    return lostPoint
  }
  
  setupTimingPattern() {
    for (let r = 8; r < this.moduleCount - 8; r++) {
      if (this.modules[r][6] != null) continue
      this.modules[r][6] = (r % 2 == 0)
    }
    
    for (let c = 8; c < this.moduleCount - 8; c++) {
      if (this.modules[6][c] != null) continue
      this.modules[6][c] = (c % 2 == 0)
    }
  }
  
  setupPositionAdjustPattern() {
    const pos = [6, 26, 46, 66]
    
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        const row = pos[i]
        const col = pos[j]
        
        if (this.modules[row][col] != null) continue
        
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
              this.modules[row + r][col + c] = true
            } else {
              this.modules[row + r][col + c] = false
            }
          }
        }
      }
    }
  }
  
  setupTypeNumber(test) {
    const bits = this.getBCHTypeNumber(this.typeNumber)
    
    for (let i = 0; i < 18; i++) {
      const mod = (!test && ((bits >> i) & 1) == 1)
      this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod
    }
    
    for (let i = 0; i < 18; i++) {
      const mod = (!test && ((bits >> i) & 1) == 1)
      this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod
    }
  }
  
  setupTypeInfo(test, maskPattern) {
    const data = (this.errorCorrectLevel << 3) | maskPattern
    const bits = this.getBCHTypeInfo(data)
    
    for (let i = 0; i < 15; i++) {
      const mod = (!test && ((bits >> i) & 1) == 1)
      
      if (i < 6) {
        this.modules[i][8] = mod
      } else if (i < 8) {
        this.modules[i + 1][8] = mod
      } else {
        this.modules[this.moduleCount - 15 + i][8] = mod
      }
    }
    
    for (let i = 0; i < 15; i++) {
      const mod = (!test && ((bits >> i) & 1) == 1)
      
      if (i < 8) {
        this.modules[8][this.moduleCount - i - 1] = mod
      } else if (i < 9) {
        this.modules[8][15 - i - 1 + 1] = mod
      } else {
        this.modules[8][15 - i - 1] = mod
      }
    }
    
    this.modules[this.moduleCount - 8][8] = (!test)
  }
  
  mapData(data, maskPattern) {
    let inc = -1
    let row = this.moduleCount - 1
    let bitIndex = 7
    let byteIndex = 0
    
    for (let col = this.moduleCount - 1; col > 0; col -= 2) {
      if (col == 6) col--
      
      while (true) {
        for (let c = 0; c < 2; c++) {
          if (this.modules[row][col - c] == null) {
            let dark = false
            
            if (byteIndex < data.length) {
              dark = (((data[byteIndex] >>> bitIndex) & 1) == 1)
            }
            
            const mask = this.getMask(maskPattern, row, col - c)
            
            if (mask) {
              dark = !dark
            }
            
            this.modules[row][col - c] = dark
            bitIndex--
            
            if (bitIndex == -1) {
              byteIndex++
              bitIndex = 7
            }
          }
        }
        
        row += inc
        
        if (row < 0 || this.moduleCount <= row) {
          row -= inc
          inc = -inc
          break
        }
      }
    }
  }
  
  getMask(maskPattern, i, j) {
    switch (maskPattern) {
      case 0: return (i + j) % 2 == 0
      case 1: return i % 2 == 0
      case 2: return j % 3 == 0
      case 3: return (i + j) % 3 == 0
      case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0
      case 5: return (i * j) % 2 + (i * j) % 3 == 0
      case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0
      case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0
      default: throw new Error('bad maskPattern:' + maskPattern)
    }
  }
  
  getBCHTypeInfo(data) {
    let d = data << 10
    while (this.getBCHDigit(d) - this.getBCHDigit(0x537) >= 0) {
      d ^= (0x537 << (this.getBCHDigit(d) - this.getBCHDigit(0x537)))
    }
    return ((data << 10) | d) ^ 0x5412
  }
  
  getBCHTypeNumber(data) {
    let d = data << 12
    while (this.getBCHDigit(d) - this.getBCHDigit(0x1f25) >= 0) {
      d ^= (0x1f25 << (this.getBCHDigit(d) - this.getBCHDigit(0x1f25)))
    }
    return (data << 12) | d
  }
  
  getBCHDigit(data) {
    let digit = 0
    while (data != 0) {
      digit++
      data >>>= 1
    }
    return digit
  }
  
  createData(typeNumber, errorCorrectLevel, dataList) {
    const rsBlocks = []
    const buffer = []
    
    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i]
      buffer.push(data.mode)
      buffer.push(data.data.length)
      
      for (let j = 0; j < data.data.length; j++) {
        buffer.push(data.data.charCodeAt(j))
      }
    }
    
    return buffer
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
  min-height: 150px;
}

.qrcode-canvas {
  max-width: 100%;
  height: auto;
  border: 1px solid #eee;
  border-radius: 4px;
}

.qrcode-label {
  margin: 10px 0;
  font-size: 14px;
  color: #666;
  word-break: break-all;
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
