<script setup>
import { ref } from 'vue'

const domain = ref('www.geekery.cn')
const organization = ref('Geekery')
const organizationalUnit = ref('IT')
const country = ref('CN')
const province = ref('Beijing')
const city = ref('Beijing')
const email = ref('admin@geekery.cn')
const keySize = ref(2048)

const csr = ref('')
const privateKey = ref('')
const isGenerating = ref(false)
const errorMsg = ref('')

function pem(b, label) {
  const bin = btoa(String.fromCharCode(...new Uint8Array(b)))
  const lines = bin.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function createSequence(contents) {
  const totalLen = contents.reduce((sum, arr) => sum + arr.length, 0)
  
  let lengthBytes
  if (totalLen < 128) {
    lengthBytes = new Uint8Array([totalLen])
  } else if (totalLen < 256) {
    lengthBytes = new Uint8Array([0x81, totalLen])
  } else if (totalLen < 65536) {
    lengthBytes = new Uint8Array([0x82, (totalLen >> 8) & 0xFF, totalLen & 0xFF])
  } else {
    lengthBytes = new Uint8Array([0x83, (totalLen >> 16) & 0xFF, (totalLen >> 8) & 0xFF, totalLen & 0xFF])
  }
  
  const result = new Uint8Array(1 + lengthBytes.length + totalLen)
  result[0] = 0x30 // SEQUENCE tag
  result.set(lengthBytes, 1)
  
  let offset = 1 + lengthBytes.length
  for (const arr of contents) {
    result.set(arr, offset)
    offset += arr.length
  }
  
  return result
}

function intToDER(num) {
  let hex = num.toString(16)
  if (hex.length % 2) hex = '0' + hex
  const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16))
  return new Uint8Array([0x02, bytes.length, ...bytes])
}

function createName(cn, o, ou, c, st, l, email) {
  const parts = []
  
  // 每个 RDN 是 SET { SEQUENCE { OID, STRING } }
  if (c) {
    const oid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x06]) // countryName OID
    const val = new TextEncoder().encode(c)
    const str = new Uint8Array([0x13, val.length, ...val]) // PrintableString
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  if (st) {
    const oid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x08]) // stateOrProvinceName OID
    const val = new TextEncoder().encode(st)
    const str = new Uint8Array([0x0C, val.length, ...val]) // UTF8String
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  if (l) {
    const oid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x07]) // localityName OID
    const val = new TextEncoder().encode(l)
    const str = new Uint8Array([0x0C, val.length, ...val]) // UTF8String
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  if (o) {
    const oid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x0A]) // organizationName OID
    const val = new TextEncoder().encode(o)
    const str = new Uint8Array([0x0C, val.length, ...val]) // UTF8String
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  if (ou) {
    const oid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x0B]) // organizationalUnitName OID
    const val = new TextEncoder().encode(ou)
    const str = new Uint8Array([0x0C, val.length, ...val]) // UTF8String
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  if (cn) {
    const oid = new Uint8Array([0x06, 0x03, 0x55, 0x04, 0x03]) // commonName OID
    const val = new TextEncoder().encode(cn)
    const str = new Uint8Array([0x0C, val.length, ...val]) // UTF8String
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  if (email) {
    const oid = new Uint8Array([0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x09, 0x01]) // emailAddress OID
    const val = new TextEncoder().encode(email)
    const str = new Uint8Array([0x16, val.length, ...val]) // IA5String
    const seq = createSequence([oid, str])
    const set = new Uint8Array([0x31, seq.length, ...seq])
    parts.push(set)
  }
  
  return createSequence(parts)
}

async function generateCSR() {
  errorMsg.value = ''
  if (!domain.value.trim()) { errorMsg.value = '请输入域名'; return }
  
  isGenerating.value = true
  try {
    // Generate key pair using RSASSA-PKCS1-v1_5 for signing
    const kp = await window.crypto.subtle.generateKey(
      { 
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: keySize.value, 
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true, 
      ['sign', 'verify']
    )
    
    // Export private key
    const pkBuf = await window.crypto.subtle.exportKey('pkcs8', kp.privateKey)
    privateKey.value = pem(pkBuf, 'RSA PRIVATE KEY')
    
    // Create CSR info
    const subject = createName(domain.value, organization.value, organizationalUnit.value, country.value, province.value, city.value, email.value)
    
    // Export public key for CSR (SPKI format)
    const pubBuf = await window.crypto.subtle.exportKey('spki', kp.publicKey)
    const pubKeyInfo = new Uint8Array(pubBuf)
    
    // Build CSR TBS (CertificationRequestInfo)
    const version = new Uint8Array([0x02, 0x01, 0x00]) // version 0
    const attributes = new Uint8Array([0xA0, 0x00]) // empty attributes with context tag [0]
    
    // Combine all parts
    const tbsParts = []
    tbsParts.push(version)
    tbsParts.push(subject)
    tbsParts.push(pubKeyInfo)
    tbsParts.push(attributes)
    
    const tbs = createSequence(tbsParts)
    
    // Sign CSR using SHA-256 with RSASSA-PKCS1-v1_5
    const tbsBytes = new Uint8Array(tbs)
    const sig = await window.crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' }, 
      kp.privateKey, 
      tbsBytes
    )
    
    // Build final CSR with SHA-256 signature algorithm OID
    // sha256WithRSAEncryption: 1.2.840.113549.1.1.11
    const alg = new Uint8Array([0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x0B, 0x05, 0x00])
    const sigBytes = new Uint8Array(sig)
    const sigBit = new Uint8Array([0x03, 1 + sigBytes.length, 0x00, ...sigBytes])
    const csrBuffer = createSequence([tbs, alg, sigBit])
    
    csr.value = pem(csrBuffer, 'CERTIFICATE REQUEST')
  } catch (e) {
    errorMsg.value = '生成失败: ' + e.message
    console.error('CSR生成错误:', e)
  } finally {
    isGenerating.value = false
  }
}

function download(content, name) {
  const b = new Blob([content], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(b)
  a.download = name
  a.click()
}

function copy(t) { navigator.clipboard.writeText(t); alert('已复制') }
function reset() { domain.value = 'www.geekery.cn'; organization.value = 'Geekery'; organizationalUnit.value = 'IT'; country.value = 'CN'; province.value = 'Beijing'; city.value = 'Beijing'; email.value = 'admin@geekery.cn'; csr.value = ''; privateKey.value = '' }
</script>

<template>
  <div class="csr-generator">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">📋</span>
      <div>
        <div class="tool-name">CSR 生成</div>
        <div class="tool-desc">生成证书签名请求（Certificate Signing Request）</div>
      </div>
    </div>

    <!-- 证书信息 -->
    <div class="section">
      <div class="section-title">证书信息</div>
      <div class="field">
        <label>域名 (CN)</label>
        <input v-model="domain" placeholder="example.com" :disabled="isGenerating" />
      </div>
      <div class="form-row">
        <div class="field">
          <label>组织 (O)</label>
          <input v-model="organization" placeholder="My Org" :disabled="isGenerating" />
        </div>
        <div class="field">
          <label>组织单位 (OU)</label>
          <input v-model="organizationalUnit" placeholder="IT" :disabled="isGenerating" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>国家 (C)</label>
          <input v-model="country" placeholder="CN" :disabled="isGenerating" />
        </div>
        <div class="field">
          <label>省份 (ST)</label>
          <input v-model="province" placeholder="Beijing" :disabled="isGenerating" />
        </div>
      </div>
      <div class="form-row">
        <div class="field">
          <label>城市 (L)</label>
          <input v-model="city" placeholder="Beijing" :disabled="isGenerating" />
        </div>
        <div class="field">
          <label>邮箱 (E)</label>
          <input v-model="email" placeholder="admin@example.com" :disabled="isGenerating" />
        </div>
      </div>
    </div>

    <!-- 密钥参数 -->
    <div class="section">
      <div class="section-title">密钥参数</div>
      <div class="field">
        <label>密钥长度</label>
        <div class="seg-ctrl">
          <button :class="['seg-btn', { active: keySize === 2048 }]" @click="keySize = 2048" :disabled="isGenerating">2048 位</button>
          <button :class="['seg-btn', { active: keySize === 4096 }]" @click="keySize = 4096" :disabled="isGenerating">4096 位</button>
        </div>
      </div>
    </div>

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="generateCSR" class="btn-primary" :disabled="isGenerating">
        <span v-if="isGenerating" class="spinner"></span>
        {{ isGenerating ? '生成中...' : '生成 CSR' }}
      </button>
      <button v-if="csr" @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="csr">
      <div class="result-block" style="margin-top:10px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            私钥
          </span>
          <div class="result-actions">
            <button @click="copy(privateKey)" class="btn-copy">复制</button>
            <button @click="download(privateKey, 'private-key.pem')" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ privateKey }}</pre>
      </div>
      <div class="result-block" style="margin-top:8px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            CSR
          </span>
          <div class="result-actions">
            <button @click="copy(csr)" class="btn-copy">复制</button>
            <button @click="download(csr, 'request.csr')" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ csr }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.csr-generator { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field label { font-size: 12px; font-weight: 500; color: #555; }
.field input { padding: 7px 10px; border: 1px solid #e0e0e0; border-radius: 5px; font-size: 12px; box-sizing: border-box; outline: none; transition: border-color .15s; width: 100%; }
.field input:focus { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.seg-ctrl { display: flex; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; }
.seg-btn { flex: 1; padding: 6px 10px; border: none; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all .15s; border-right: 1px solid #e0e0e0; }
.seg-btn:last-child { border-right: none; }
.seg-btn:hover:not(:disabled) { background: #f0f0f0; }
.seg-btn.active { background: #2196F3; color: #fff; font-weight: 500; }
.seg-btn:disabled { opacity: .45; cursor: not-allowed; }
.error-bar { display: flex; align-items: center; gap: 6px; background: #fdecea; color: #c62828; padding: 8px 12px; border-radius: 5px; font-size: 12px; margin-bottom: 10px; border: 1px solid #f5c6cb; }
.action-bar { display: flex; gap: 8px; margin-top: 14px; }
.btn-primary { flex: 1; padding: 10px 20px; background: #2196F3; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s; box-shadow: 0 1px 3px rgba(33,150,243,.3); }
.btn-primary:hover:not(:disabled) { background: #1976D2; }
.btn-primary:disabled { background: #90CAF9; cursor: not-allowed; box-shadow: none; }
.btn-reset { padding: 10px 18px; background: #fff; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-reset:hover { background: #f5f5f5; }
.result-block { border: 1px solid #c8e6c9; border-radius: 6px; overflow: hidden; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.result-actions { display: flex; gap: 6px; }
.btn-copy { padding: 4px 12px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-copy:hover { background: #e3f2fd; }
.btn-dl { padding: 4px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-dl:hover { background: #388E3C; }
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 200px; }
.spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
