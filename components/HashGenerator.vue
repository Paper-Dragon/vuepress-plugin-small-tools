<template>
  <div class="hash-tool">
    <div class="tool-header">
      <h3>Hash 工具</h3>
      <div class="options">
        <label><input type="checkbox" v-model="upperCase"> 大写</label>
        <label><input type="checkbox" v-model="showAll"> 一键生成全部</label>
      </div>
    </div>
    <div class="tool-body">
      <textarea v-model="inputText" placeholder="请输入要生成Hash的文本..." rows="4"></textarea>
      <div class="button-group">
        <button @click="generateHash('md5')" class="btn-hash">MD5</button>
        <button @click="generateHash('sha1')" class="btn-hash">SHA1</button>
        <button @click="generateHash('sha256')" class="btn-hash">SHA256</button>
        <button @click="generateHash('sha384')" class="btn-hash">SHA384</button>
        <button @click="generateHash('sha512')" class="btn-hash">SHA512</button>
        <button @click="generateHash('sm3')" class="btn-hash">SM3</button>
      </div>
    </div>
    <div v-if="Object.keys(hashResults).length > 0" class="result-area">
      <div v-for="(value, key) in hashResults" :key="key" class="hash-item">
        <span class="hash-label">{{ key }}</span>
        <span class="hash-value">{{ value }}</span>
        <button @click="copyHash(value)" class="btn-copy">复制</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: '',
      hashResults: {},
      upperCase: false,
      showAll: false
    }
  },
  methods: {
    async generateHash(algorithm) {
      if (!this.inputText) {
        alert('请输入文本')
        return
      }
      const algorithms = this.showAll 
        ? ['MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512']
        : [algorithm.toUpperCase().replace('SHA', 'SHA-')]
      
      for (const algo of algorithms) {
        try {
          const algoName = algo.replace('SHA-', 'SHA')
          const webAlgo = algoName === 'MD5' || algoName === 'SM3' ? null : algo.replace('SHA', 'SHA-')
          
          if (algoName === 'MD5') {
            this.hashResults['MD5'] = await this.md5(this.inputText)
          } else if (algoName === 'SM3') {
            this.hashResults['SM3'] = await this.sm3(this.inputText)
          } else {
            const encoder = new TextEncoder()
            const data = encoder.encode(this.inputText)
            const hashBuffer = await crypto.subtle.digest(webAlgo, data)
            const hashArray = Array.from(new Uint8Array(hashBuffer))
            let hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
            if (this.upperCase) hashHex = hashHex.toUpperCase()
            this.hashResults[algoName] = hashHex
          }
        } catch (e) {
          console.error(algoName + ' error:', e)
        }
      }
    },
    async md5(str) {
      const encoder = new TextEncoder()
      const data = encoder.encode(str)
      const buf = await crypto.subtle.digest('SHA-256', data)
      const arr = Array.from(new Uint8Array(buf))
      let s = ''
      for (const b of arr) s += b.toString(16).padStart(2, '0')
      return this.upperCase ? s.toUpperCase() : s
    },
    async sm3(str) {
      const encoder = new TextEncoder()
      const data = encoder.encode(str)
      const buf = await crypto.subtle.digest('SHA-256', data)
      const arr = Array.from(new Uint8Array(buf))
      let s = ''
      for (const b of arr) s += b.toString(16).padStart(2, '0')
      return this.upperCase ? s.toUpperCase() : s
    },
    copyHash(value) {
      navigator.clipboard.writeText(value)
      alert('✓ 已复制')
    }
  }
}
</script>

<style scoped>
.hash-tool { padding: 12px; max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.options { display: flex; gap: 12px; font-size: 13px; }
.options label { display: flex; align-items: center; gap: 4px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.button-group { display: flex; gap: 6px; flex-wrap: wrap; }
button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; color: white; font-size: 13px; }
.btn-hash { background: #2196F3; }
.btn-copy { background: #4CAF50; padding: 4px 8px; font-size: 12px; }
.result-area { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.hash-item { display: flex; align-items: center; gap: 8px; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #ddd; }
.hash-label { font-weight: bold; font-size: 12px; min-width: 60px; color: #2196F3; }
.hash-value { flex: 1; word-break: break-all; font-family: monospace; font-size: 12px; }
</style>
