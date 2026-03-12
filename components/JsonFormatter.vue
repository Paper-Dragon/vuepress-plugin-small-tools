<template>
  <div class="json-tool">
    <div class="tool-header">
      <h3>JSON 工具</h3>
      <div class="options">
        <label>缩进：<select v-model="indent">
          <option value="2">2空格</option>
          <option value="4">4空格</option>
          <option value="tab">Tab</option>
        </select></label>
        <label><input type="checkbox" v-model="sortKeys"> 排序键</label>
      </div>
    </div>
    <div class="tool-body">
      <div class="input-area">
        <textarea v-model="inputJson" placeholder="请输入JSON字符串..." rows="6"></textarea>
        <div class="button-group">
          <button @click="formatJson" class="btn-format">格式化</button>
          <button @click="compressJson" class="btn-compress">压缩</button>
          <button @click="validateJson" class="btn-validate">校验</button>
          <button @click="clearAll" class="btn-clear">清空</button>
        </div>
      </div>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
      <div v-if="resultJson" class="result-area">
        <textarea v-model="resultJson" readonly rows="6"></textarea>
        <button @click="copyResult" class="btn-copy">复制</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputJson: '',
      resultJson: '',
      errorMessage: '',
      indent: '2',
      sortKeys: false
    }
  },
  methods: {
    formatJson() {
      if (!this.inputJson.trim()) {
        this.errorMessage = '请输入JSON字符串'
        this.resultJson = ''
        return
      }
      try {
        let parsed = JSON.parse(this.inputJson)
        if (this.sortKeys) {
          parsed = this.sortObjectKeys(parsed)
        }
        const indent = this.indent === 'tab' ? '\t' : parseInt(this.indent)
        this.resultJson = JSON.stringify(parsed, null, indent)
        this.errorMessage = ''
      } catch (e) {
        this.errorMessage = 'JSON格式错误: ' + e.message
        this.resultJson = ''
      }
    },
    compressJson() {
      if (!this.inputJson.trim()) {
        this.errorMessage = '请输入JSON字符串'
        this.resultJson = ''
        return
      }
      try {
        const parsed = JSON.parse(this.inputJson)
        this.resultJson = JSON.stringify(parsed)
        this.errorMessage = ''
      } catch (e) {
        this.errorMessage = 'JSON格式错误: ' + e.message
        this.resultJson = ''
      }
    },
    validateJson() {
      if (!this.inputJson.trim()) {
        this.errorMessage = '请输入JSON字符串'
        return
      }
      try {
        JSON.parse(this.inputJson)
        this.errorMessage = '✓ JSON格式正确'
      } catch (e) {
        this.errorMessage = '✗ JSON格式错误: ' + e.message
      }
    },
    clearAll() {
      this.inputJson = ''
      this.resultJson = ''
      this.errorMessage = ''
    },
    copyResult() {
      navigator.clipboard.writeText(this.resultJson)
      this.errorMessage = '✓ 已复制到剪贴板'
    },
    sortObjectKeys(obj) {
      if (Array.isArray(obj)) {
        return obj.map(item => this.sortObjectKeys(item))
      }
      if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).sort().reduce((result, key) => {
          result[key] = this.sortObjectKeys(obj[key])
          return result
        }, {})
      }
      return obj
    }
  }
}
</script>

<style scoped>
.json-tool { padding: 12px; max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; color: #333; }
.options { display: flex; gap: 12px; align-items: center; font-size: 13px; }
.options select { padding: 3px 6px; border: 1px solid #ddd; border-radius: 3px; }
.options label { display: flex; align-items: center; gap: 4px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
.input-area, .result-area { display: flex; flex-direction: column; gap: 8px; }
textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.button-group { display: flex; gap: 6px; flex-wrap: wrap; }
button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; color: white; font-size: 13px; }
.btn-format { background: #2196F3; }
.btn-compress { background: #4CAF50; }
.btn-validate { background: #FF9800; }
.btn-clear { background: #f44336; }
.btn-copy { background: #9C27B0; }
.error-message { color: #f44336; padding: 8px; background: #ffebee; border-radius: 4px; font-size: 13px; }
</style>
