<template>
  <div class="jwt-tool">
    <div class="tool-header">
      <h3>JWT 解码</h3>
      <div class="options">
        <label><input type="checkbox" v-model="showSignature"> 显示签名</label>
        <label><input type="checkbox" v-model="autoDecode"> 输入时自动解码</label>
      </div>
    </div>
    <div class="tool-body">
      <textarea v-model="jwtToken" placeholder="请输入JWT Token..." rows="3" @input="autoDecode && decodeJwt()"></textarea>
      <div class="button-group">
        <button @click="decodeJwt" class="btn-decode">解码</button>
        <button @click="verifyToken" class="btn-verify">验证</button>
        <button @click="clearAll" class="btn-clear">清空</button>
      </div>
    </div>
    <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    <div v-if="decoded.header" class="result-area">
      <div class="jwt-section">
        <div class="section-header">Header <button @click="copyJson(decoded.header)" class="btn-small">复制</button></div>
        <pre>{{ formatJson(decoded.header) }}</pre>
      </div>
      <div class="jwt-section">
        <div class="section-header">Payload <button @click="copyJson(decoded.payload)" class="btn-small">复制</button></div>
        <pre>{{ formatJson(decoded.payload) }}</pre>
        <div v-if="decoded.payload.exp || decoded.payload.iat" class="token-info">
          <span v-if="decoded.payload.exp">过期: {{ formatTime(decoded.payload.exp) }}</span>
          <span v-if="decoded.payload.iat">签发: {{ formatTime(decoded.payload.iat) }}</span>
        </div>
      </div>
      <div class="jwt-section" v-if="showSignature && decoded.signature">
        <div class="section-header">Signature</div>
        <pre class="signature">{{ decoded.signature }}</pre>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      jwtToken: '',
      decoded: { header: null, payload: null, signature: '' },
      errorMessage: '',
      showSignature: true,
      autoDecode: false
    }
  },
  methods: {
    decodeJwt() {
      try {
        const parts = this.jwtToken.trim().split('.')
        if (parts.length !== 3) {
          throw new Error('JWT格式无效')
        }
        this.decoded.header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')))
        this.decoded.payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        this.decoded.signature = parts[2]
        this.errorMessage = ''
      } catch (e) {
        this.errorMessage = '✗ 解码失败: ' + e.message
        this.decoded = { header: null, payload: null, signature: '' }
      }
    },
    verifyToken() {
      if (!this.decoded.payload) {
        this.errorMessage = '请先解码'
        return
      }
      if (this.decoded.payload.exp && Date.now() / 1000 > this.decoded.payload.exp) {
        this.errorMessage = '⚠ Token已过期'
      } else if (this.decoded.payload.exp) {
        this.errorMessage = '✓ Token有效'
      } else {
        this.errorMessage = '⚠ Token无过期时间'
      }
    },
    formatJson(obj) {
      return JSON.stringify(obj, null, 2)
    },
    formatTime(timestamp) {
      return new Date(timestamp * 1000).toLocaleString('zh-CN')
    },
    copyJson(obj) {
      navigator.clipboard.writeText(JSON.stringify(obj))
      alert('✓ 已复制')
    },
    clearAll() {
      this.jwtToken = ''
      this.decoded = { header: null, payload: null, signature: '' }
      this.errorMessage = ''
    }
  }
}
</script>

<style scoped>
.jwt-tool { padding: 12px; max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.options { display: flex; gap: 12px; font-size: 13px; }
.options label { display: flex; align-items: center; gap: 4px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 13px; resize: vertical; box-sizing: border-box; }
.button-group { display: flex; gap: 6px; flex-wrap: wrap; }
button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; color: white; font-size: 13px; }
.btn-decode { background: #2196F3; }
.btn-verify { background: #FF9800; }
.btn-clear { background: #f44336; }
.btn-small { padding: 2px 8px; font-size: 11px; background: #4CAF50; margin-left: 10px; }
.error-message { color: #f44336; padding: 8px; background: #ffebee; border-radius: 4px; font-size: 13px; margin: 10px 0; }
.result-area { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
.jwt-section { background: #fff; border-radius: 6px; border: 1px solid #ddd; overflow: hidden; }
.section-header { padding: 8px 12px; background: #e3f2fd; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
pre { margin: 0; padding: 12px; font-size: 12px; overflow-x: auto; }
.signature { word-break: break-all; color: #666; }
.token-info { padding: 8px 12px; background: #f5f5f5; font-size: 12px; display: flex; gap: 15px; }
.token-info span { color: #1976D2; }
</style>
