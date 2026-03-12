<template>
  <div class="url-tool">
    <div class="tool-header">
      <h3>URL 编码/解码</h3>
      <div class="options">
        <label><input type="checkbox" v-model="both"> 双向转换</label>
      </div>
    </div>
    <div class="tool-body">
      <textarea v-model="inputText" placeholder="请输入要编码/解码的文本..." rows="4"></textarea>
      <div class="button-group">
        <button @click="encodeUrl" class="btn-encode">URL编码</button>
        <button @click="decodeUrl" class="btn-decode">URL解码</button>
        <button @click="encodeComponent" class="btn-encode">组件编码</button>
        <button @click="decodeComponent" class="btn-decode">组件解码</button>
        <button @click="clearAll" class="btn-clear">清空</button>
      </div>
    </div>
    <div v-if="resultText" class="result-area">
      <textarea v-model="resultText" readonly rows="4"></textarea>
      <button @click="copyResult" class="btn-copy">复制</button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: '',
      resultText: '',
      both: false
    }
  },
  methods: {
    encodeUrl() {
      this.resultText = encodeURI(this.inputText)
    },
    decodeUrl() {
      try { this.resultText = decodeURI(this.inputText) } 
      catch (e) { alert('解码失败: ' + e.message) }
    },
    encodeComponent() {
      this.resultText = encodeURIComponent(this.inputText)
    },
    decodeComponent() {
      try { this.resultText = decodeURIComponent(this.inputText) } 
      catch (e) { alert('解码失败: ' + e.message) }
    },
    clearAll() {
      this.inputText = ''
      this.resultText = ''
    },
    copyResult() {
      navigator.clipboard.writeText(this.resultText)
      alert('✓ 已复制')
    }
  }
}
</script>

<style scoped>
.url-tool { padding: 12px; max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.options { font-size: 13px; }
.options label { display: flex; align-items: center; gap: 4px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.button-group { display: flex; gap: 6px; flex-wrap: wrap; }
button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; color: white; font-size: 13px; }
.btn-encode { background: #2196F3; }
.btn-decode { background: #4CAF50; }
.btn-clear { background: #f44336; }
.btn-copy { background: #9C27B0; margin-top: 8px; }
.result-area { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
</style>
