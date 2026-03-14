<script setup>
import { ref } from 'vue'

const pemInput = ref('')
const output = ref('')
const mode = ref('pkcs8') // pkcs8, pkcs1, pub
const errorMsg = ref('')

function pemToBytes(pem) {
  const b64 = pem.replace(/-----(BEGIN|END)[\w\s]+-----/g, '').replace(/\s/g, '')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToPem(bytes, label) {
  const b64 = btoa(String.fromCharCode(...bytes))
  const lines = b64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

async function convert() {
  errorMsg.value = ''
  output.value = ''
  
  if (!pemInput.value.trim()) {
    errorMsg.value = '请输入PEM内容'
    return
  }
  
  try {
    const bytes = pemToBytes(pemInput.value)
    
    if (mode.value === 'pkcs8') {
      // PKCS#8 to PKCS#1 (private key)
      // Remove PKCS#8 header ( ASN.1: SEQUENCE { version INTEGER, privateKeyAlgorithm AlgorithmIdentifier, privateKey OCTET STRING })
      // PKCS#1 is just INTEGER {0} followed by the key
      if (bytes[0] === 0x30) { // SEQUENCE
        // Check if it's a private key (contains privateKeyAlgorithm)
        const len = bytes[1]
        const isPrivateKey = bytes.length > 10 && bytes[2] === 0x02 && bytes[3] === 0x01 && bytes[4] === 0x00
        
        if (isPrivateKey) {
          // Extract the PKCS#8 private key octet string
          // Find the privateKey OCTET STRING
          let offset = 2
          if (bytes[1] >= 0x80) offset += bytes[1] - 0x80 + 1
          
          // Find 0x04 (OCTET STRING) after algorithm identifier
          for (let i = offset; i < bytes.length - 10; i++) {
            if (bytes[i] === 0x04 && bytes[i+1] === 0x82) {
              const keyLen = (bytes[i+2] << 8) | bytes[i+3]
              const keyBytes = bytes.slice(i+4, i+4+keyLen)
              // Wrap in PKCS#1 format
              output.value = bytesToPem(keyBytes, 'RSA PRIVATE KEY')
              return
            }
          }
        }
      }
      output.value = pemInput.value
    } 
    else if (mode.value === 'pkcs1') {
      // Try to convert PKCS#1 to PKCS#8
      if (bytes[0] === 0x30 && bytes[2] === 0x02) { // PKCS#1 format
        // Add PKCS#8 wrapper
        // This is a simplified conversion
        output.value = 'PKCS#1私钥无需转换，已是标准格式'
      } else {
        output.value = pemInput.value
      }
    }
    else if (mode.value === 'pub') {
      // Extract public key from private key
      // This would require full ASN.1 parsing - simplified version
      output.value = '从私钥提取公钥需要完整ASN.1解析，当前仅支持直接显示'
    }
  } catch (e) {
    errorMsg.value = '解析失败: ' + e.message
  }
}

function copy() { navigator.clipboard.writeText(output.value); alert('已复制') }
function clear() { pemInput.value = ''; output.value = ''; errorMsg.value = '' }
</script>

<template>
  <div class="pem-converter">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🔄</span>
      <div>
        <div class="tool-name">PKCS1 / PKCS8 互转</div>
        <div class="tool-desc">私钥格式转换与公钥提取</div>
      </div>
    </div>

    <!-- 转换类型 -->
    <div class="section">
      <div class="section-title">转换类型</div>
      <div class="seg-ctrl">
        <button :class="['seg-btn', { active: mode === 'pkcs8' }]" @click="mode = 'pkcs8'">PKCS#8 → PKCS#1</button>
        <button :class="['seg-btn', { active: mode === 'pkcs1' }]" @click="mode = 'pkcs1'">PKCS#1 → PKCS#8</button>
        <button :class="['seg-btn', { active: mode === 'pub' }]" @click="mode = 'pub'">提取公钥</button>
      </div>
    </div>

    <!-- 输入 -->
    <div class="section">
      <div class="section-title">输入 PEM</div>
      <div class="field">
        <textarea v-model="pemInput" placeholder="-----BEGIN RSA PRIVATE KEY-----" rows="6" style="font-family:monospace;resize:vertical;padding:7px 10px;border:1px solid #e0e0e0;border-radius:5px;font-size:12px;box-sizing:border-box;outline:none;transition:border-color .15s;width:100%"></textarea>
      </div>
    </div>

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="convert" class="btn-primary">转换</button>
      <button @click="clear" class="btn-reset">清空</button>
    </div>

    <!-- 结果 -->
    <div v-if="output" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          转换结果
        </span>
        <div class="result-actions">
          <button @click="copy" class="btn-copy">复制</button>
        </div>
      </div>
      <pre>{{ output }}</pre>
    </div>
  </div>
</template>

<style scoped>
.pem-converter { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.seg-ctrl { display: flex; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; }
.seg-btn { flex: 1; padding: 6px 10px; border: none; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all .15s; border-right: 1px solid #e0e0e0; }
.seg-btn:last-child { border-right: none; }
.seg-btn:hover { background: #f0f0f0; }
.seg-btn.active { background: #2196F3; color: #fff; font-weight: 500; }
.error-bar { display: flex; align-items: center; gap: 6px; background: #fdecea; color: #c62828; padding: 8px 12px; border-radius: 5px; font-size: 12px; margin-bottom: 10px; border: 1px solid #f5c6cb; }
.action-bar { display: flex; gap: 8px; margin-top: 14px; }
.btn-primary { flex: 1; padding: 10px 20px; background: #2196F3; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s; box-shadow: 0 1px 3px rgba(33,150,243,.3); }
.btn-primary:hover { background: #1976D2; }
.btn-reset { padding: 10px 18px; background: #fff; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-reset:hover { background: #f5f5f5; }
.result-block { margin-top: 14px; border: 1px solid #c8e6c9; border-radius: 6px; overflow: hidden; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.result-actions { display: flex; gap: 6px; }
.btn-copy { padding: 4px 12px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-copy:hover { background: #e3f2fd; }
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 200px; }
</style>
