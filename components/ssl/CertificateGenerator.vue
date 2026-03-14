<script setup>
import { ref } from 'vue'

// 表单数据
const domain = ref('www.geekery.cn')
const domains = ref('geekery.cn\n*.geekery.cn')
const organization = ref('Geekery Technology')
const organizationalUnit = ref('IT Department')
const country = ref('CN')
const province = ref('Beijing')
const city = ref('Beijing')
const email = ref('admin@geekery.cn')
const validityDays = ref(365)
const keySize = ref(2048)
const isCA = ref(false)

// 生成的证书
const privateKey = ref('')
const certificate = ref('')
const caCertificate = ref('')

const isGenerating = ref(false)
const errorMsg = ref('')

// ASN.1 工具函数
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
  if (c) parts.push(new Uint8Array([0x31, 3, 0x06, 1, 0x55, 0x04, 6, ...new TextEncoder().encode(c)]))
  if (st) { const b = new TextEncoder().encode(st); parts.push(new Uint8Array([0x31, 3 + b.length, 0x0C, b.length, ...b])) }
  if (l) { const b = new TextEncoder().encode(l); parts.push(new Uint8Array([0x31, 3 + b.length, 0x0C, b.length, ...b])) }
  if (o) { const b = new TextEncoder().encode(o); parts.push(new Uint8Array([0x31, 3 + b.length, 0x0C, b.length, ...b])) }
  if (ou) { const b = new TextEncoder().encode(ou); parts.push(new Uint8Array([0x31, 3 + b.length, 0x0C, b.length, ...b])) }
  if (cn) { const b = new TextEncoder().encode(cn); parts.push(new Uint8Array([0x31, 3 + b.length, 0x0C, b.length, ...b])) }
  if (email) { const b = new TextEncoder().encode(email); parts.push(new Uint8Array([0x31, 3 + b.length, 0x0C, b.length, ...b])) }
  return createSequence(parts)
}

function createTime(ts) {
  const d = new Date(ts * 1000)
  const s = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}Z`
  const b = new TextEncoder().encode(s)
  return new Uint8Array([0x17, b.length, ...b])
}

function buildSAN(d) {
  if (!d) return null
  const list = d.split(/[,\n]/).map(x => x.trim()).filter(x => x)
  if (!list.length) return null
  const parts = list.map(x => { const b = new TextEncoder().encode(x); return new Uint8Array([0x82, b.length, ...b]) })
  const content = createSequence(parts)
  const oid = new Uint8Array([0x06, 0x03, 0x55, 0x1D, 0x11])
  return createSequence([new Uint8Array([0x30, ...oid, 0x01, 0x01, 0xFF, 0x00]), new Uint8Array([0x04, content.length, ...content])])
}

function buildKeyUsage(ca) {
  const ku = ca ? new Uint8Array([0x03, 0x02, 0x01, 0x86]) : new Uint8Array([0x03, 0x02, 0x01, 0xA0])
  const oid = new Uint8Array([0x06, 0x03, 0x55, 0x1D, 0x0F])
  return createSequence([new Uint8Array([0x30, ...oid]), new Uint8Array([0x01, 0x01, 0xFF]), new Uint8Array([0x04, ku.length, ...ku])])
}

function buildBasicConstraints(ca) {
  const bc = ca ? new Uint8Array([0x30, 0x03, 0x01, 0x01, 0xFF]) : new Uint8Array([0x30, 0x00])
  const oid = new Uint8Array([0x06, 0x03, 0x55, 0x1D, 0x13])
  return createSequence([new Uint8Array([0x30, ...oid]), new Uint8Array([0x04, bc.length, ...bc])])
}

function buildCertTBS(sn, nb, na, cn, o, ou, c, st, l, email, isCA, san) {
  const v = createSequence([createTime(nb), createTime(na)])
  const alg = new Uint8Array([0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x0B, 0x05, 0x00])
  const issuer = createName(cn, o, ou, c, st, l, email)
  const subject = createName(cn, o, ou, c, st, l, email)
  const spki = createSequence([new Uint8Array([0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01, 0x05, 0x00]), new Uint8Array([0x03, 0x01, 0x00, 0x01])])
  const exts = [buildKeyUsage(isCA), buildBasicConstraints(isCA)]
  if (san) exts.push(san)
  return createSequence([new Uint8Array([0xA0, 0x03, 0x02, 0x01, 0x02]), intToDER(sn), alg, issuer, v, subject, spki, createSequence(exts)])
}

function buildCert(tbs, sig) {
  const alg = new Uint8Array([0x30, 0x0D, 0x06, 0x09, 0x2A, 0x86, 0x48, 0x86, 0xF7, 0x01, 0x01, 0x0B, 0x05, 0x00])
  const sigBytes = new Uint8Array(sig)
  const sigBit = new Uint8Array([0x03, 1 + sigBytes.length, 0x00, ...sigBytes])
  return createSequence([tbs, alg, sigBit]).buffer
}

function pem(b, label) {
  const bin = btoa(String.fromCharCode(...new Uint8Array(b)))
  const lines = bin.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

async function generate() {
  errorMsg.value = ''
  if (!domain.value.trim()) { errorMsg.value = '请输入域名'; return }
  if (!organization.value.trim()) { errorMsg.value = '请输入组织名称'; return }
  
  isGenerating.value = true
  try {
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
    const pkBuf = await window.crypto.subtle.exportKey('pkcs8', kp.privateKey)
    privateKey.value = pem(pkBuf, 'RSA PRIVATE KEY')
    
    const now = Math.floor(Date.now() / 1000)
    const nb = now, na = now + validityDays.value * 86400
    const sn = Math.floor(Math.random() * 0xFFFFFFFF)
    const san = buildSAN(domains.value || domain.value)
    const tbs = buildCertTBS(sn, nb, na, domain.value, organization.value, organizationalUnit.value, country.value, province.value, city.value, email.value, isCA.value, san)
    const tbsBytes = new Uint8Array(tbs)
    const sig = await window.crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, kp.privateKey, tbsBytes)
    certificate.value = pem(buildCert(tbs, sig), 'CERTIFICATE')
    
    if (isCA.value) {
      const caSn = sn + 1
      const caNa = na * 10
      const caTbs = buildCertTBS(caSn, nb, caNa, organization.value, organization.value, organizationalUnit.value, country.value, province.value, city.value, email.value, true, null)
      const caSig = await window.crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, kp.privateKey, new Uint8Array(caTbs))
      caCertificate.value = pem(buildCert(caTbs, caSig), 'CERTIFICATE')
    }
  } catch (e) {
    errorMsg.value = '生成失败: ' + e.message
    console.error('证书生成错误:', e)
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
function reset() { domain.value = ''; domains.value = ''; organization.value = ''; organizationalUnit.value = ''; country.value = 'CN'; province.value = ''; city.value = ''; email.value = ''; validityDays.value = 365; keySize.value = 2048; isCA.value = false; privateKey.value = ''; certificate.value = ''; caCertificate.value = ''; errorMsg.value = '' }
</script>

<template>
  <div class="cert-generator">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🏷️</span>
      <div>
        <div class="tool-name">自签名 SSL 证书</div>
        <div class="tool-desc">生成自签名 X.509 证书，适用于内网/测试环境</div>
      </div>
    </div>

    <!-- 证书信息 -->
    <div class="section">
      <div class="section-title">证书信息</div>
      <div class="field">
        <label>主域名 (CN) <span class="req">*</span></label>
        <input v-model="domain" placeholder="example.com" :disabled="isGenerating" />
      </div>
      <div class="field">
        <label>备用域名 (SAN)</label>
        <textarea v-model="domains" placeholder="每行一个，如：*.example.com" rows="2" :disabled="isGenerating"
          style="font-family:monospace;resize:vertical;padding:7px 10px;border:1px solid #e0e0e0;border-radius:5px;font-size:12px;box-sizing:border-box;outline:none;transition:border-color .15s;width:100%"
        ></textarea>
      </div>
      <div class="form-row">
        <div class="field">
          <label>组织 (O) <span class="req">*</span></label>
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
          <input v-model="email" type="email" placeholder="admin@example.com" :disabled="isGenerating" />
        </div>
      </div>
    </div>

    <!-- 密钥与有效期 -->
    <div class="section">
      <div class="section-title">密钥与有效期</div>
      <div class="form-row">
        <div class="field">
          <label>密钥长度</label>
          <div class="seg-ctrl">
            <button :class="['seg-btn', { active: keySize === 2048 }]" @click="keySize = 2048" :disabled="isGenerating">2048 位</button>
            <button :class="['seg-btn', { active: keySize === 4096 }]" @click="keySize = 4096" :disabled="isGenerating">4096 位</button>
          </div>
        </div>
        <div class="field">
          <label>有效天数</label>
          <div class="day-buttons">
            <button v-for="d in [365, 730, 3650]" :key="d"
              :class="['day-btn', { active: validityDays === d }]"
              @click="validityDays = d" :disabled="isGenerating">{{ d }}</button>
            <input v-model.number="validityDays" type="number" min="1" max="36500" :disabled="isGenerating"
              style="width:70px;padding:4px 8px;border:1px solid #e0e0e0;border-radius:4px;font-size:12px;box-sizing:border-box;outline:none" />
          </div>
        </div>
      </div>
    </div>

    <!-- CA 选项 -->
    <div class="section">
      <div class="ca-block" :class="{ 'ca-active': isCA }">
        <label class="ca-toggle">
          <input type="checkbox" v-model="isCA" :disabled="isGenerating" />
          <span class="ca-toggle-text">生成 CA 根证书</span>
        </label>
        <p class="ca-hint">勾选后将同时生成 CA 证书，可用于签发下级证书</p>
      </div>
    </div>

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="generate" class="btn-primary" :disabled="isGenerating">
        <span v-if="isGenerating" class="spinner"></span>
        {{ isGenerating ? '生成中...' : '生成证书' }}
      </button>
      <button v-if="certificate" @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="certificate">
      <div class="result-block" style="margin-top:10px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            私钥
          </span>
          <div class="result-actions">
            <button @click="copy(privateKey)" class="btn-copy">复制</button>
            <button @click="download(privateKey, 'key.pem')" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ privateKey }}</pre>
      </div>
      <div class="result-block" style="margin-top:8px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            证书
          </span>
          <div class="result-actions">
            <button @click="copy(certificate)" class="btn-copy">复制</button>
            <button @click="download(certificate, 'cert.pem')" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ certificate }}</pre>
      </div>
      <div v-if="caCertificate" class="result-block" style="margin-top:8px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            CA 证书
          </span>
          <div class="result-actions">
            <button @click="copy(caCertificate)" class="btn-copy">复制</button>
            <button @click="download(caCertificate, 'ca.pem')" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ caCertificate }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cert-generator { padding: 16px; font-size: 13px; color: #333; }
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
.req { color: #f44336; }
.seg-ctrl { display: flex; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; }
.seg-btn { flex: 1; padding: 6px 10px; border: none; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all .15s; border-right: 1px solid #e0e0e0; }
.seg-btn:last-child { border-right: none; }
.seg-btn:hover:not(:disabled) { background: #f0f0f0; }
.seg-btn.active { background: #2196F3; color: #fff; font-weight: 500; }
.seg-btn:disabled { opacity: .45; cursor: not-allowed; }
.day-buttons { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.day-btn { padding: 4px 10px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all .15s; }
.day-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
.day-btn.active { background: #2196F3; color: #fff; border-color: #2196F3; font-weight: 500; }
.day-btn:disabled { opacity: .45; cursor: not-allowed; }
.ca-block { border: 1px solid #ffe082; border-radius: 6px; padding: 10px 12px; background: #fffde7; transition: all .2s; }
.ca-block.ca-active { border-color: #FFC107; background: #fff8e1; }
.ca-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.ca-toggle input { width: 15px; height: 15px; accent-color: #FFC107; }
.ca-toggle-text { font-size: 13px; font-weight: 500; color: #5d4037; }
.ca-hint { font-size: 11px; color: #aaa; margin: 4px 0 0 0; }
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
