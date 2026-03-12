<template>
  <div class="qrcode-batch">
    <div class="input-section">
      <h3>二维码批量生成器</h3>
      <textarea
        v-model="inputText"
        placeholder="每行输入一个网址或文本..."
        rows="6"
      ></textarea>
      
      <div class="options">
        <label>
          尺寸:
          <input type="number" v-model="options.size" min="100" max="1000" step="50" />
          px
        </label>
        <label>
          边距:
          <input type="number" v-model="options.margin" min="0" max="10" />
        </label>
        <label>
          容错级别:
          <select v-model="options.errorCorrectionLevel">
            <option value="L">低 (7%)</option>
            <option value="M">中 (15%)</option>
            <option value="Q">较高 (25%)</option>
            <option value="H">高 (30%)</option>
          </select>
        </label>
        <label>
          并发数:
          <input type="number" v-model="options.concurrency" min="1" max="20" />
        </label>
      </div>
      
      <div class="actions">
        <button @click="generateAll" :disabled="isGenerating">
          {{ isGenerating ? `生成中... (${completedCount}/${totalCount})` : '批量生成' }}
        </button>
        <button @click="clearResults" :disabled="isGenerating">清空结果</button>
        <button @click="downloadAll" :disabled="results.length === 0 || isGenerating">下载全部</button>
      </div>
      
      <div v-if="isGenerating" class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>
    </div>
    
    <div class="results" v-if="results.length > 0">
      <div class="result-item" v-for="(item, index) in results" :key="index">
        <img :src="item.url" :alt="item.text" />
        <p class="qr-text">{{ item.text }}</p>
        <button @click="downloadSingle(item, index)">下载</button>
      </div>
    </div>
    
    <div v-else class="empty-state">
      <p>输入网址或文本，点击"批量生成"按钮</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import qrcode from 'qrcode'

const inputText = ref('')
const results = ref([])
const isGenerating = ref(false)
const completedCount = ref(0)
const totalCount = ref(0)

const options = ref({
  size: 200,
  margin: 2,
  errorCorrectionLevel: 'M',
  concurrency: 10  // 默认并发数
})

const progressPercent = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((completedCount.value / totalCount.value) * 100)
})

// 并发生成二维码（带并发控制）
const generateAll = async () => {
  if (isGenerating.value) return
  
  const lines = inputText.value.split('\n').filter(line => line.trim())
  if (lines.length === 0) return
  
  isGenerating.value = true
  results.value = []
  completedCount.value = 0
  totalCount.value = lines.length
  
  const concurrency = options.value.concurrency
  const tasks = lines.map((line, index) => async () => {
    try {
      const qr = await qrcode.toDataURL(line.trim(), {
        width: options.value.size,
        margin: options.value.margin,
        errorCorrectionLevel: options.value.errorCorrectionLevel,
        // 使用 worker 如果可用
        worker: typeof Worker !== 'undefined'
      })
      
      results.value[index] = {
        text: line.trim(),
        url: qr
      }
    } catch (error) {
      console.error(`生成二维码失败: ${line}`, error)
      results.value[index] = {
        text: line.trim(),
        url: '',
        error: error.message
      }
    }
    
    completedCount.value++
  })
  
  // 并发执行控制
  const runTasks = async () => {
    const executing = []
    
    for (const task of tasks) {
      const promise = task()
      executing.push(promise)
      
      if (executing.length >= concurrency) {
        await Promise.race(executing)
        // 移除已完成的
        const completed = executing.filter(p => {
          if (p instanceof Promise) {
            return p.then ? false : true  // 简化判断
          }
          return true
        })
      }
    }
    
    // 等待所有剩余任务完成
    await Promise.allSettled(executing)
  }
  
  // 简化的并发控制
  const runWithConcurrency = async () => {
    const queue = [...tasks]
    const executing = new Set()
    
    while (queue.length > 0 || executing.size > 0) {
      // 启动新任务直到达到并发限制
      while (queue.length > 0 && executing.size < concurrency) {
        const task = queue.shift()
        const promise = (async () => {
          await task()
          executing.delete(promise)
        })()
        executing.add(promise)
      }
      
      // 等待任意一个完成
      if (executing.size > 0) {
        await Promise.race(executing)
      }
    }
  }
  
  try {
    await runWithConcurrency()
  } catch (error) {
    console.error('批量生成出错:', error)
  } finally {
    isGenerating.value = false
  }
}

const clearResults = () => {
  results.value = []
  inputText.value = ''
  completedCount.value = 0
  totalCount.value = 0
}

const downloadSingle = (item, index) => {
  if (!item.url) return
  
  const link = document.createElement('a')
  link.href = item.url
  link.download = `qrcode-${index + 1}.png`
  link.click()
}

const downloadAll = () => {
  results.value.forEach((item, index) => {
    if (item.url) {
      setTimeout(() => {
        const link = document.createElement('a')
        link.href = item.url
        link.download = `qrcode-${index + 1}.png`
        link.click()
      }, index * 100)  // 延迟下载避免浏览器阻止
    }
  })
}
</script>

<style scoped>
.qrcode-batch {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.input-section {
  margin-bottom: 20px;
}

h3 {
  margin-bottom: 15px;
  color: #333;
}

textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  resize: vertical;
  font-family: monospace;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 15px;
  margin: 15px 0;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
}

.options label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 14px;
}

.options input,
.options select {
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
}

.actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  background: #007acc;
  color: white;
  cursor: pointer;
  font-size: 14px;
}

.actions button:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.actions button:hover:not(:disabled) {
  background: #005fa3;
}

.progress-bar {
  margin-top: 15px;
  height: 20px;
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #007acc, #00d4aa);
  transition: width 0.3s ease;
}

.results {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 20px;
}

.result-item {
  text-align: center;
  padding: 15px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.result-item img {
  max-width: 100%;
  height: auto;
}

.qr-text {
  margin: 10px 0;
  font-size: 12px;
  word-break: break-all;
  color: #666;
}

.result-item button {
  padding: 4px 12px;
  border: none;
  border-radius: 4px;
  background: #28a745;
  color: white;
  cursor: pointer;
  font-size: 12px;
}

.result-item button:hover {
  background: #218838;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}
</style>
