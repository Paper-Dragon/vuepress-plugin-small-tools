<script setup>
import { ref } from 'vue'

const pfxInput = ref('')   // base64 or file
const password = ref('')
const showPassword = ref(false)
const result = ref(null)
const errorMsg = ref('')
const isProcessing = ref(false)

function loadPfxFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pfx,.p12'
  input.onchange = () => {
    const file = input.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const bytes = new Uint8Array(e.target.result)
      pfxInput.value = btoa(String.fromCharCode(...bytes))
    }
    reader.readAsArrayBuffer(file)
  }
  input.click()
}

// ---- ASN.1 parser ----
function readTLV(buf, offset) {
  if (offset >= buf.length) return null
  const tag = buf[offset]; let lenOff = offset + 1, len
  if (buf[lenOff] < 128) { len = buf[lenOff]; lenOff++ }
  else if (buf[lenOff] === 0x81) { len = buf[lenOff+1]; lenOff += 2 }
  else if (buf[lenOff] === 0x82) { len = (buf[lenOff+1] << 8) | buf[lenOff+2]; lenOff += 3 }
  else { len = buf[lenOff+1]; lenOff += 2 }
  return { tag, start: offset, end: lenOff + len, valueStart: lenOff, len }
}

function readOID(buf, offset, len) {
  const bytes = buf.slice(offset, offset + len)
  const parts = [Math.floor(bytes[0] / 40), bytes[0] % 40]
  let val = 0
  for (let i = 1; i < bytes.length; i++) {
    val = (val << 7) | (bytes[i] & 0x7F)
    if (!(bytes[i] & 0x80)) { parts.push(val); val = 0 }
  }
  return parts.join('.')
}

const OID_NAMES = {
  '1.2.840.113549.1.7.1': 'data',
  '1.2.840.113549.1.7.6': 'encryptedData',
  '1.2.840.113549.1.12.10.1.1': 'keyBag',
  '1.2.840.113549.1.12.10.1.2': 'pkcs8ShroudedKeyBag',
  '1.2.840.113549.1.12.10.1.3': 'certBag',
  '1.2.840.113549.1.9.20': 'friendlyName',
  '1.2.840.113549.1.9.21': 'localKeyId',
  '1.2.840.113549.1.9.22.1': 'x509Certificate',
}

function bytesToPem(bytes, label) {
  const b64 = btoa(String.fromCharCode(...bytes))
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`
}

// 递归扫描 ASN.1，提取 certBag 和 keyBag
function scanBags(buf, offset, end, bags) {
  while (offset < end) {
    const t = readTLV(buf, offset)
    if (!t) break
    if (t.tag === 0x30 || t.tag === 0x31 || (t.tag & 0xE0) === 0xA0) {
      scanBags(buf, t.valueStart, t.end, bags)
    } else if (t.tag === 0x06) {
      const o = readOID(buf, t.valueStart, t.len)
      if (o === '1.2.840.113549.1.12.10.1.3') {
        // certBag: next sibling should be [0] containing certValue
        const next = readTLV(buf, t.end)
        if (next && (next.tag & 0xE0) === 0xA0) {
          // inside: SEQUENCE { OID x509Cert, [0] OCTET STRING }
          const inner = readTLV(buf, next.valueStart)
          if (inner && inner.tag === 0x30) {
            const oidT = readTLV(buf, inner.valueStart)
            if (oidT && oidT.tag === 0x06) {
              const certOid = readOID(buf, oidT.valueStart, oidT.len)
              if (certOid === '1.2.840.113549.1.9.22.1') {
                const ctxT = readTLV(buf, oidT.end)
                if (ctxT) {
                  const octetT = readTLV(buf, ctxT.valueStart)
                  if (octetT && octetT.tag === 0x04) {
                    bags.certs.push(buf.slice(octetT.valueStart, octetT.end))
                  }
                }
              }
            }
          }
        }
      } else if (o === '1.2.840.113549.1.12.10.1.1' || o === '1.2.840.113549.1.12.10.1.2') {
        // keyBag or shroudedKeyBag
        const next = readTLV(buf, t.end)
        if (next && (next.tag & 0xE0) === 0xA0) {
          const inner = readTLV(buf, next.valueStart)
          if (inner) {
            if (o === '1.2.840.113549.1.12.10.1.1') {
              // keyBag: [0] contains PKCS#8 key directly
              bags.keys.push({ type: 'unencrypted', data: buf.slice(inner.valueStart, inner.end) })
            } else {
              bags.keys.push({ type: 'encrypted', note: '加密私钥（需要密码解密，当前版本仅提取结构）' })
            }
          }
        }
      }
    }
    offset = t.end
  }
}

async function parse() {
  errorMsg.value = ''; result.value = null
  const raw = pfxInput.value.trim()
  if (!raw) { errorMsg.value = '请输入 PFX Base64 或上传文件'; return }

  isProcessing.value = true
  try {
    const bytes = new Uint8Array(atob(raw.replace(/\s/g, '')).split('').map(c => c.charCodeAt(0)))
    const bags = { certs: [], keys: [] }
    scanBags(bytes, 0, bytes.length, bags)

    result.value = {
      certCount: bags.certs.length,
      keyCount: bags.keys.length,
      certs: bags.certs.map((c, i) => ({ label: `证书 ${i+1}`, pem: bytesToPem(c, 'CERTIFICATE') })),
      keys: bags.keys.map((k, i) => ({
        label: `私钥 ${i+1}`,
        pem: k.type === 'unencrypted' ? bytesToPem(k.data, 'PRIVATE KEY') : null,
        note: k.note
      }))
    }
  } catch (e) {
    errorMsg.value = '解析失败: ' + e.message; console.error(e)
  } finally {
    isProcessing.value = false
  }
}

function copy(t) { navigator.clipboard.writeText(t); alert('已复制') }
function download(content, name) {
  const b = new Blob([content], { type: 'text/plain' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click()
}
function reset() { pfxInput.value = ''; password.value = ''; result.value = null; errorMsg.value = '' }
</script>

<template>
  <div class="pfx-parse">
    <div class="tool-title">
      <span class="tool-icon">🔓</span>
      <div>
        <div class="tool-name">PFX 解析 / 私钥提取</div>
        <div class="tool-desc">解析 PKCS#12 (.pfx/.p12) 文件，提取证书与私钥</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">PFX 文件</div>
      <div class="upload-area" @click="loadPfxFile">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="1.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span>点击上传 .pfx / .p12 文件</span>
        <span v-if="pfxInput" class="uploaded-hint">✓ 已加载（{{ pfxInput.length }} 字符 Base64）</span>
      </div>
      <div class="or-divider">或粘贴 Base64</div>
      <textarea v-model="pfxInput" placeholder="粘贴 PFX 文件的 Base64 内容..." rows="3" :disabled="isProcessing"></textarea>
    </div>

    <div class="section">
      <div class="section-title">密码（如有）</div>
      <div class="pw-field">
        <input :type="showPassword ? 'text' : 'password'" v-model="password" placeholder="留空则不使用密码" :disabled="isProcessing" />
        <button class="eye-btn" @click="showPassword = !showPassword">{{ showPassword ? '🙈' : '👁' }}</button>
      </div>
    </div>

    <div v-if="errorMsg" class="error-bar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <div class="action-bar">
      <button @click="parse" class="btn-primary" :disabled="isProcessing">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '解析中...' : '🔓 解析 PFX' }}
      </button>
      <button v-if="result" @click="reset" class="btn-reset">重置</button>
    </div>

    <div v-if="result" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          解析成功 — {{ result.certCount }} 个证书，{{ result.keyCount }} 个私钥
        </span>
      </div>

      <div v-for="(cert, i) in result.certs" :key="'c'+i" class="result-item">
        <div class="result-item-header">
          <span>{{ cert.label }}</span>
          <div class="result-actions">
            <button @click="copy(cert.pem)" class="btn-copy">复制</button>
            <button @click="download(cert.pem, `cert-${i+1}.pem`)" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ cert.pem }}</pre>
      </div>

      <div v-for="(key, i) in result.keys" :key="'k'+i" class="result-item">
        <div class="result-item-header">
          <span>{{ key.label }}</span>
          <div v-if="key.pem" class="result-actions">
            <button @click="copy(key.pem)" class="btn-copy">复制</button>
            <button @click="download(key.pem, `private-${i+1}.key`)" class="btn-dl">下载</button>
          </div>
        </div>
        <pre v-if="key.pem">{{ key.pem }}</pre>
        <div v-else class="enc-note">{{ key.note }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pfx-parse { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.upload-area { border: 2px dashed #e0e0e0; border-radius: 6px; padding: 20px; text-align: center; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12px; color: #aaa; transition: all .15s; }
.upload-area:hover { border-color: #2196F3; color: #2196F3; background: #f3f9ff; }
.uploaded-hint { color: #4CAF50; font-size: 11px; }
.or-divider { text-align: center; font-size: 11px; color: #ccc; margin: 8px 0; }
textarea { width: 100%; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 11.5px; font-family: monospace; box-sizing: border-box; outline: none; resize: vertical; }
textarea:focus { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.pw-field { display: flex; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff; }
.pw-field:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.pw-field input { flex: 1; padding: 8px 12px; border: none; outline: none; font-size: 13px; }
.eye-btn { padding: 0 12px; border: none; background: transparent; cursor: pointer; font-size: 16px; }
.error-bar { display: flex; align-items: center; gap: 6px; background: #fdecea; color: #c62828; padding: 8px 12px; border-radius: 5px; font-size: 12px; margin-bottom: 10px; border: 1px solid #f5c6cb; }
.action-bar { display: flex; gap: 8px; margin-top: 14px; }
.btn-primary { flex: 1; padding: 10px 20px; background: #2196F3; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s; box-shadow: 0 1px 3px rgba(33,150,243,.3); }
.btn-primary:hover:not(:disabled) { background: #1976D2; }
.btn-primary:disabled { background: #90CAF9; cursor: not-allowed; box-shadow: none; }
.btn-reset { padding: 10px 18px; background: #fff; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-reset:hover { background: #f5f5f5; }
.spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.result-block { margin-top: 14px; border: 1px solid #c8e6c9; border-radius: 6px; overflow: hidden; }
.result-header { display: flex; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.result-item { border-top: 1px solid #e8f5e9; }
.result-item-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f9fbe7; font-size: 12px; font-weight: 500; color: #555; }
.result-actions { display: flex; gap: 6px; }
.btn-copy { padding: 4px 12px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-copy:hover { background: #e3f2fd; }
.btn-dl { padding: 4px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-dl:hover { background: #388E3C; }
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 180px; }
.enc-note { padding: 10px 12px; font-size: 12px; color: #f57c00; background: #fff8e1; }
</style>
