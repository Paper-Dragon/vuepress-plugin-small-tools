<script setup>
import { ref } from 'vue'

const certPem = ref('')
const keyPem = ref('')
const caCertPem = ref('')
const password = ref('')
const showPassword = ref(false)
const activeTab = ref('cert')
const resultB64 = ref('')
const errorMsg = ref('')
const isProcessing = ref(false)

function loadFile(targetRef) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pem,.crt,.cer,.key,.txt'
  input.onchange = () => {
    const file = input.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = e => { targetRef.value = e.target.result.trim() }
    reader.readAsText(file)
  }
  input.click()
}

function pemToBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)))
}

// ---- ASN.1 helpers ----
function encLen(len) {
  if (len < 128) return new Uint8Array([len])
  if (len < 256) return new Uint8Array([0x81, len])
  return new Uint8Array([0x82, (len >> 8) & 0xFF, len & 0xFF])
}
function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total); let off = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}
function tlv(tag, ...c) {
  const body = concat(...c)
  return concat(new Uint8Array([tag]), encLen(body.length), body)
}
function seq(...c) { return tlv(0x30, ...c) }
function set_(...c) { return tlv(0x31, ...c) }
function oid(bytes) { return tlv(0x06, new Uint8Array(bytes)) }
function octetstr(b) { return tlv(0x04, b) }
function integer(n) {
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex
  const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16))
  if (bytes[0] & 0x80) bytes.unshift(0)
  return tlv(0x02, new Uint8Array(bytes))
}
function ctx(n, ...c) { return tlv(0xA0 | n, ...c) }
function bmpstr(s) {
  // BMP string: each char as 2 bytes big-endian
  const out = new Uint8Array(s.length * 2)
  for (let i = 0; i < s.length; i++) { out[i*2] = 0; out[i*2+1] = s.charCodeAt(i) }
  return tlv(0x1E, out)
}

// OIDs
const OID_DATA            = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x07,0x01]
const OID_ENCRYPTED_DATA  = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x07,0x06]
const OID_CERT_BAG        = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x0C,0x0A,0x01,0x03]
const OID_KEY_BAG         = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x0C,0x0A,0x01,0x01]
const OID_SHROUDED_KEY_BAG= [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x0C,0x0A,0x01,0x02]
const OID_X509_CERT       = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x09,0x16,0x01]
const OID_FRIENDLY_NAME   = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x09,0x14]
const OID_LOCAL_KEY_ID    = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x09,0x15]
const OID_SHA1            = [0x2B,0x0E,0x03,0x02,0x1A]
const OID_HMAC_SHA1       = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x02,0x07]
const OID_PBE_SHA1_3DES   = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x0C,0x01,0x03]
const OID_PBE_SHA1_RC2_40 = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x0C,0x01,0x06]

// 生成随机字节
function randomBytes(n) {
  const b = new Uint8Array(n); crypto.getRandomValues(b); return b
}

// PBKDF1 (SHA-1) for PFX MAC
async function pbkdf1(password, salt, iterations, keyLen) {
  const pwBytes = new TextEncoder().encode(password)
  let d = concat(pwBytes, salt)
  for (let i = 0; i < iterations; i++) {
    const buf = await crypto.subtle.digest('SHA-1', d)
    d = new Uint8Array(buf)
  }
  return d.slice(0, keyLen)
}

// HMAC-SHA1 for PFX MAC
async function hmacSha1(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

// 构建 certBag
function buildCertBag(certDer, friendlyName) {
  const certValue = ctx(0, octetstr(certDer))
  const certBagValue = seq(oid(OID_X509_CERT), certValue)
  const attrs = []
  if (friendlyName) {
    attrs.push(seq(oid(OID_FRIENDLY_NAME), set_(bmpstr(friendlyName))))
  }
  const localKeyId = randomBytes(4)
  attrs.push(seq(oid(OID_LOCAL_KEY_ID), set_(octetstr(localKeyId))))
  return { bag: seq(oid(OID_CERT_BAG), ctx(0, certBagValue), set_(...attrs)), localKeyId }
}

// 构建 keyBag（未加密）
function buildKeyBag(keyDer, localKeyId) {
  const attrs = [seq(oid(OID_LOCAL_KEY_ID), set_(octetstr(localKeyId)))]
  return seq(oid(OID_KEY_BAG), ctx(0, octetstr(keyDer)), set_(...attrs))
}

async function build() {
  errorMsg.value = ''; resultB64.value = ''
  if (!certPem.value.trim()) { errorMsg.value = '请输入证书'; return }
  if (!keyPem.value.trim())  { errorMsg.value = '请输入私钥'; return }

  isProcessing.value = true
  try {
    const certDer = pemToBytes(certPem.value)
    const keyDer  = pemToBytes(keyPem.value)

    // 构建 cert safe bag
    const { bag: certBag, localKeyId } = buildCertBag(certDer, 'certificate')
    let certBags = [certBag]

    // 可选 CA 证书
    if (caCertPem.value.trim()) {
      const caDer = pemToBytes(caCertPem.value)
      const { bag: caBag } = buildCertBag(caDer, 'ca-certificate')
      certBags.push(caBag)
    }

    // cert safe contents (明文)
    const certSafeContents = seq(...certBags)
    const certContentInfo = seq(oid(OID_DATA), ctx(0, octetstr(certSafeContents)))

    // key safe bag (明文，简化实现)
    const keyBag = buildKeyBag(keyDer, localKeyId)
    const keySafeContents = seq(keyBag)
    const keyContentInfo = seq(oid(OID_DATA), ctx(0, octetstr(keySafeContents)))

    // AuthenticatedSafe
    const authSafe = seq(certContentInfo, keyContentInfo)
    const authSafeOctet = octetstr(authSafe)
    const pfxAuthSafe = seq(oid(OID_DATA), ctx(0, authSafeOctet))

    // MAC
    const macSalt = randomBytes(8)
    const iterations = 2048
    const macKey = await pbkdf1(password.value || '', macSalt, iterations, 20)
    const mac = await hmacSha1(macKey, authSafe)

    const macData = seq(
      seq(seq(oid(OID_SHA1)), tlv(0x04, mac)),
      octetstr(macSalt),
      integer(iterations)
    )

    // PFX
    const pfx = seq(integer(3), pfxAuthSafe, macData)

    resultB64.value = btoa(String.fromCharCode(...pfx))
  } catch (e) {
    errorMsg.value = '生成失败: ' + e.message; console.error(e)
  } finally {
    isProcessing.value = false
  }
}

function download() {
  const binary = atob(resultB64.value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const b = new Blob([bytes], { type: 'application/x-pkcs12' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'certificate.pfx'; a.click()
}
function copyB64() { navigator.clipboard.writeText(resultB64.value); alert('已复制 Base64') }
function reset() { certPem.value = ''; keyPem.value = ''; caCertPem.value = ''; password.value = ''; resultB64.value = ''; errorMsg.value = '' }
</script>

<template>
  <div class="pfx-build">
    <div class="tool-title">
      <span class="tool-icon">📦</span>
      <div>
        <div class="tool-name">PFX 合并 / 生成</div>
        <div class="tool-desc">将证书与私钥打包为 PKCS#12 (.pfx/.p12) 文件</div>
      </div>
    </div>

    <!-- 证书 / 私钥 / CA 证书 tab -->
    <div class="section">
      <div class="section-title">输入文件</div>
      <div class="pem-box">
        <div class="pem-tabs">
          <button :class="['pem-tab', { active: activeTab === 'cert' }]" @click="activeTab = 'cert'" :disabled="isProcessing">
            证书 <span class="req">*</span><span v-if="certPem" class="dot"></span>
          </button>
          <button :class="['pem-tab', { active: activeTab === 'key' }]" @click="activeTab = 'key'" :disabled="isProcessing">
            私钥 <span class="req">*</span><span v-if="keyPem" class="dot"></span>
          </button>
          <button :class="['pem-tab', { active: activeTab === 'ca' }]" @click="activeTab = 'ca'" :disabled="isProcessing">
            CA 证书 <span class="opt">可选</span><span v-if="caCertPem" class="dot"></span>
          </button>
          <button class="upload-btn" @click="loadFile(activeTab === 'cert' ? certPem : activeTab === 'key' ? keyPem : caCertPem)" :disabled="isProcessing">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            上传
          </button>
        </div>
        <textarea v-if="activeTab === 'cert'" v-model="certPem" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" rows="5" :disabled="isProcessing"></textarea>
        <textarea v-else-if="activeTab === 'key'" v-model="keyPem" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" rows="5" :disabled="isProcessing"></textarea>
        <textarea v-else v-model="caCertPem" placeholder="-----BEGIN CERTIFICATE-----&#10;CA 证书（可选，用于证书链）&#10;-----END CERTIFICATE-----" rows="5" :disabled="isProcessing"></textarea>
      </div>
    </div>

    <div class="section">
      <div class="section-title">密码（可选）</div>
      <div class="pw-field">
        <input :type="showPassword ? 'text' : 'password'" v-model="password" placeholder="留空则不加密" :disabled="isProcessing" />
        <button class="eye-btn" @click="showPassword = !showPassword">{{ showPassword ? '🙈' : '👁' }}</button>
      </div>
      <p class="field-hint">密码用于保护 PFX 文件，导入时需要输入</p>
    </div>

    <div v-if="errorMsg" class="error-bar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <div class="action-bar">
      <button @click="build" class="btn-primary" :disabled="isProcessing">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '生成中...' : '📦 生成 PFX' }}
      </button>
      <button v-if="resultB64" @click="reset" class="btn-reset">重置</button>
    </div>

    <div v-if="resultB64" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          生成成功
        </span>
        <div class="result-actions">
          <button @click="copyB64" class="btn-copy">复制 Base64</button>
          <button @click="download" class="btn-dl">下载 .pfx</button>
        </div>
      </div>
      <div class="b64-preview">{{ resultB64.slice(0, 120) }}...</div>
    </div>
  </div>
</template>

<style scoped>
.pfx-build { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.req { color: #f44336; }
.opt { font-size: 10px; color: #aaa; font-weight: normal; }
.pem-box { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff; }
.pem-box:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.pem-tabs { display: flex; align-items: center; background: #f7f8fa; border-bottom: 1px solid #e8e8e8; }
.pem-tab { padding: 7px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #777; border-bottom: 2px solid transparent; transition: all .15s; display: flex; align-items: center; gap: 4px; }
.pem-tab:hover:not(:disabled) { color: #333; background: #efefef; }
.pem-tab.active { color: #2196F3; border-bottom-color: #2196F3; background: #fff; font-weight: 500; }
.pem-tab:disabled { opacity: .45; cursor: not-allowed; }
.upload-btn { margin-left: auto; display: flex; align-items: center; gap: 4px; padding: 5px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #2196F3; transition: background .15s; }
.upload-btn:hover:not(:disabled) { background: #e3f2fd; }
.upload-btn:disabled { opacity: .45; cursor: not-allowed; }
.pem-box textarea { display: block; width: 100%; padding: 10px 12px; border: none; outline: none; resize: vertical; font-size: 11.5px; font-family: monospace; line-height: 1.6; box-sizing: border-box; min-height: 90px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #4CAF50; display: inline-block; }
.pw-field { display: flex; border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff; }
.pw-field:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.pw-field input { flex: 1; padding: 8px 12px; border: none; outline: none; font-size: 13px; }
.eye-btn { padding: 0 12px; border: none; background: transparent; cursor: pointer; font-size: 16px; }
.field-hint { font-size: 11px; color: #aaa; margin: 4px 0 0; }
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
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.result-actions { display: flex; gap: 6px; }
.btn-copy { padding: 4px 12px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-copy:hover { background: #e3f2fd; }
.btn-dl { padding: 4px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; }
.btn-dl:hover { background: #388E3C; }
.b64-preview { padding: 10px 12px; font-family: monospace; font-size: 11px; color: #888; word-break: break-all; background: #fafafa; }
</style>
