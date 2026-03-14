<script setup>
import { ref } from 'vue'

const caActiveTab = ref('cert')
const caCertPem = ref('')
const caKeyPem = ref('')
const csrPem = ref('')
const validityDays = ref(365)
const isCA = ref(false)
const customKeyUsage = ref(false)
const kuDigitalSignature = ref(false)
const kuContentCommitment = ref(false)
const kuKeyEncipherment = ref(false)
const kuDataEncipherment = ref(false)
const kuKeyAgreement = ref(false)
const kuKeyCertSign = ref(false)
const kuCRLSign = ref(false)
const customEKU = ref(false)
const ekuServerAuth = ref(false)
const ekuClientAuth = ref(false)
const ekuCodeSigning = ref(false)
const ekuEmailProtection = ref(false)
const ekuTimeStamping = ref(false)

const resultCert = ref('')
const errorMsg = ref('')
const isProcessing = ref(false)
const validityOptions = [7, 30, 60, 90, 180, 365, 730, 3650]

function loadFile(targetRef) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pem,.crt,.cer,.key,.csr,.txt'
  input.onchange = () => {
    const file = input.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = e => { targetRef.value = e.target.result.trim() }
    reader.readAsText(file)
  }
  input.click()
}

// ---- ASN.1 ----
function encLen(len) {
  if (len < 128) return new Uint8Array([len])
  if (len < 256) return new Uint8Array([0x81, len])
  return new Uint8Array([0x82, (len >> 8) & 0xFF, len & 0xFF])
}
function tlv(tag, ...c) {
  const body = concat(...c)
  return concat(new Uint8Array([tag]), encLen(body.length), body)
}
function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total); let off = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}
function seq(...c) { return tlv(0x30, ...c) }
function oid(bytes) { return tlv(0x06, new Uint8Array(bytes)) }
function integer(n) {
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex
  const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16))
  if (bytes[0] & 0x80) bytes.unshift(0)
  return tlv(0x02, new Uint8Array(bytes))
}
function utctime(ts) {
  const d = new Date(ts * 1000)
  const s = `${String(d.getUTCFullYear()).slice(-2)}${p(d.getUTCMonth()+1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  return tlv(0x17, new TextEncoder().encode(s))
}
function p(n) { return String(n).padStart(2, '0') }
function bitstr(bytes, unused = 0) { return tlv(0x03, new Uint8Array([unused]), bytes) }
function ctx(n, ...c) { return tlv(0xA0 | n, ...c) }
function bool(v) { return tlv(0x01, new Uint8Array([v ? 0xFF : 0x00])) }
function octetstr(bytes) { return tlv(0x04, bytes) }

const OID_SHA256_RSA = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x01,0x0B]
const OID_BC  = [0x55,0x1D,0x13]
const OID_KU  = [0x55,0x1D,0x0F]
const OID_EKU = [0x55,0x1D,0x25]
const OID_SAN = [0x55,0x1D,0x11]
const OID_EKU_SERVER = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x01]
const OID_EKU_CLIENT = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x02]
const OID_EKU_CODE   = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x03]
const OID_EKU_EMAIL  = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x04]
const OID_EKU_TIME   = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x08]

function pemToBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)))
}
function bytesToPem(bytes, label) {
  const b64 = btoa(String.fromCharCode(...bytes))
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`
}
function readTLV(buf, offset) {
  const tag = buf[offset]; let lenOff = offset + 1, len
  if (buf[lenOff] < 128) { len = buf[lenOff]; lenOff++ }
  else if (buf[lenOff] === 0x81) { len = buf[lenOff+1]; lenOff += 2 }
  else { len = (buf[lenOff+1] << 8) | buf[lenOff+2]; lenOff += 3 }
  return { tag, start: offset, end: lenOff + len, valueStart: lenOff, len }
}

function extractSubjectFromCert(der) {
  const cs = readTLV(der, 0), ts = readTLV(der, cs.valueStart)
  let cur = ts.valueStart
  if (der[cur] === 0xA0) cur = readTLV(der, cur).end
  cur = readTLV(der, cur).end; cur = readTLV(der, cur).end
  const issuer = readTLV(der, cur)
  return der.slice(issuer.start, issuer.end)
}

// 从 CSR 中提取 Subject 和 SPKI
function extractFromCSR(der) {
  // CertificationRequest ::= SEQUENCE { certificationRequestInfo, signatureAlgorithm, signature }
  const csrSeq = readTLV(der, 0)
  const infoSeq = readTLV(der, csrSeq.valueStart)
  let cur = infoSeq.valueStart
  // version
  cur = readTLV(der, cur).end
  // subject
  const subject = readTLV(der, cur); cur = subject.end
  // subjectPublicKeyInfo
  const spki = readTLV(der, cur)
  return {
    subject: der.slice(subject.start, subject.end),
    spki: der.slice(spki.start, spki.end)
  }
}

// 从 CSR 中提取 SAN（如果有）
function extractSANFromCSR(der) {
  // 简单扫描：找 OID 2.5.29.17 (SAN)
  const sanOidBytes = new Uint8Array([0x55, 0x1D, 0x11])
  const bytes = der
  for (let i = 0; i < bytes.length - sanOidBytes.length; i++) {
    if (bytes[i] === 0x06 && bytes[i+1] === 0x03 &&
        bytes[i+2] === sanOidBytes[0] && bytes[i+3] === sanOidBytes[1] && bytes[i+4] === sanOidBytes[2]) {
      // 找到 SAN OID，后面是 OCTET STRING 包裹的 SEQUENCE
      let j = i + 5
      if (bytes[j] === 0x04) {
        const octet = readTLV(bytes, j)
        return bytes.slice(octet.valueStart, octet.end)
      }
    }
  }
  return null
}

function buildExtensions(sanBytes, kuBits, ekuOids, caFlag) {
  const exts = []
  exts.push(seq(oid(OID_BC), bool(true), octetstr(caFlag ? seq(bool(true)) : seq())))
  if (kuBits !== null) {
    const b1 = (kuBits >> 1) & 0xFF, b2 = (kuBits & 1) << 7
    const kuBytes = b2 === 0 ? new Uint8Array([b1]) : new Uint8Array([b1, b2])
    exts.push(seq(oid(OID_KU), bool(true), octetstr(bitstr(kuBytes, b2 === 0 ? 1 : 0))))
  }
  if (ekuOids && ekuOids.length > 0)
    exts.push(seq(oid(OID_EKU), octetstr(seq(...ekuOids.map(o => oid(o))))))
  if (sanBytes)
    exts.push(seq(oid(OID_SAN), octetstr(sanBytes)))
  return ctx(3, seq(...exts))
}

async function sign() {
  errorMsg.value = ''; resultCert.value = ''
  if (!caCertPem.value.trim()) { errorMsg.value = '请输入 CA 证书'; return }
  if (!caKeyPem.value.trim())  { errorMsg.value = '请输入 CA 私钥'; return }
  if (!csrPem.value.trim())    { errorMsg.value = '请输入 CSR'; return }

  isProcessing.value = true
  try {
    const caKeyDer = pemToBytes(caKeyPem.value)
    let caKey
    try {
      caKey = await crypto.subtle.importKey('pkcs8', caKeyDer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    } catch {
      caKey = await crypto.subtle.importKey('pkcs8', caKeyDer, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
    }

    const caCertDer = pemToBytes(caCertPem.value)
    const issuerBytes = extractSubjectFromCert(caCertDer)
    const csrDer = pemToBytes(csrPem.value)
    const { subject, spki } = extractFromCSR(csrDer)
    const sanBytes = extractSANFromCSR(csrDer)

    const now = Math.floor(Date.now() / 1000)
    const validity = seq(utctime(now), utctime(now + validityDays.value * 86400))
    const sigAlgSeq = seq(oid(OID_SHA256_RSA), tlv(0x05))

    let kuBits = null
    if (customKeyUsage.value) {
      kuBits = 0
      if (kuDigitalSignature.value) kuBits |= (1 << 8)
      if (kuContentCommitment.value) kuBits |= (1 << 7)
      if (kuKeyEncipherment.value) kuBits |= (1 << 6)
      if (kuDataEncipherment.value) kuBits |= (1 << 5)
      if (kuKeyAgreement.value) kuBits |= (1 << 4)
      if (kuKeyCertSign.value) kuBits |= (1 << 3)
      if (kuCRLSign.value) kuBits |= (1 << 2)
    } else {
      kuBits = isCA.value ? ((1 << 3) | (1 << 2)) : ((1 << 8) | (1 << 6))
    }

    let ekuOids = null
    if (customEKU.value) {
      ekuOids = []
      if (ekuServerAuth.value) ekuOids.push(OID_EKU_SERVER)
      if (ekuClientAuth.value) ekuOids.push(OID_EKU_CLIENT)
      if (ekuCodeSigning.value) ekuOids.push(OID_EKU_CODE)
      if (ekuEmailProtection.value) ekuOids.push(OID_EKU_EMAIL)
      if (ekuTimeStamping.value) ekuOids.push(OID_EKU_TIME)
    } else if (!isCA.value) {
      ekuOids = [OID_EKU_SERVER, OID_EKU_CLIENT]
    }

    const tbs = seq(
      ctx(0, integer(2)),
      integer(Math.floor(Math.random() * 0x7FFFFFFF) + 1),
      sigAlgSeq,
      issuerBytes,
      validity,
      subject,
      spki,
      buildExtensions(sanBytes, kuBits, ekuOids, isCA.value)
    )

    let sig
    try { sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, caKey, tbs) }
    catch { sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, caKey, tbs) }

    resultCert.value = bytesToPem(seq(tbs, sigAlgSeq, bitstr(new Uint8Array(sig), 0)), 'CERTIFICATE')
  } catch (e) {
    errorMsg.value = '签发失败: ' + e.message; console.error(e)
  } finally {
    isProcessing.value = false
  }
}

function copy(t) { navigator.clipboard.writeText(t); alert('已复制') }
function download(content, name) {
  const b = new Blob([content], { type: 'text/plain' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; a.click()
}
function reset() {
  caCertPem.value = ''; caKeyPem.value = ''; csrPem.value = ''
  validityDays.value = 365; isCA.value = false
  customKeyUsage.value = false; customEKU.value = false
  resultCert.value = ''; errorMsg.value = ''
}
</script>

<template>
  <div class="sc-tool">
    <div class="tool-title">
      <span class="tool-icon">📜</span>
      <div>
        <div class="tool-name">SSL 证书签发 (CSR)</div>
        <div class="tool-desc">使用 CA 证书对 CSR 进行签名，签发 X.509 证书</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">CA 证书 / 私钥</div>
      <div class="pem-box">
        <div class="pem-tabs">
          <button :class="['pem-tab', { active: caActiveTab === 'cert' }]" @click="caActiveTab = 'cert'" :disabled="isProcessing">
            CA 证书 <span class="req">*</span><span v-if="caCertPem" class="dot"></span>
          </button>
          <button :class="['pem-tab', { active: caActiveTab === 'key' }]" @click="caActiveTab = 'key'" :disabled="isProcessing">
            CA 私钥 <span class="req">*</span><span v-if="caKeyPem" class="dot"></span>
          </button>
          <button class="upload-btn" @click="loadFile(caActiveTab === 'cert' ? caCertPem : caKeyPem)" :disabled="isProcessing">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            上传
          </button>
        </div>
        <textarea v-if="caActiveTab === 'cert'" v-model="caCertPem" placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----" rows="4" :disabled="isProcessing"></textarea>
        <textarea v-else v-model="caKeyPem" placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----" rows="4" :disabled="isProcessing"></textarea>
      </div>
    </div>

    <div class="section">
      <div class="section-title">CSR（证书签名请求）<span class="req">*</span></div>
      <div class="pem-box single">
        <div class="pem-tabs">
          <span class="pem-tab active" style="pointer-events:none">CSR</span>
          <button class="upload-btn" @click="loadFile(csrPem)" :disabled="isProcessing">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            上传
          </button>
        </div>
        <textarea v-model="csrPem" placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;...&#10;-----END CERTIFICATE REQUEST-----" rows="5" :disabled="isProcessing"></textarea>
      </div>
    </div>

    <div class="section">
      <div class="section-title">有效期</div>
      <div class="day-buttons">
        <button v-for="d in validityOptions" :key="d" :class="['day-btn', { active: validityDays === d }]" @click="validityDays = d" :disabled="isProcessing">{{ d }}</button>
      </div>
    </div>

    <div class="section">
      <div class="section-title">高级选项</div>
      <div class="adv-block">
        <div class="adv-header">
          <span class="adv-label">密钥用法 (Key Usage)</span>
          <label class="sw"><input type="checkbox" v-model="customKeyUsage" :disabled="isProcessing" /><span>自定义</span></label>
        </div>
        <p class="adv-hint">不了解时可不选，系统将自动选择</p>
        <div v-if="customKeyUsage" class="cb-grid">
          <label class="cb-item"><input type="checkbox" v-model="kuDigitalSignature" :disabled="isProcessing" /><span>数字签名 <em>digitalSignature</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuContentCommitment" :disabled="isProcessing" /><span>内容承诺 <em>contentCommitment</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuKeyEncipherment" :disabled="isProcessing" /><span>密钥加密 <em>keyEncipherment</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuDataEncipherment" :disabled="isProcessing" /><span>数据加密 <em>dataEncipherment</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuKeyAgreement" :disabled="isProcessing" /><span>密钥协商 <em>keyAgreement</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuKeyCertSign" :disabled="isProcessing" /><span>证书签名 <em>keyCertSign</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuCRLSign" :disabled="isProcessing" /><span>CRL 签名 <em>cRLSign</em></span></label>
        </div>
      </div>
      <div class="adv-block">
        <div class="adv-header">
          <span class="adv-label">增强型密钥用法 (EKU)</span>
          <label class="sw"><input type="checkbox" v-model="customEKU" :disabled="isProcessing" /><span>自定义</span></label>
        </div>
        <p class="adv-hint">不了解时可不选，系统将自动选择</p>
        <div v-if="customEKU" class="cb-grid">
          <label class="cb-item"><input type="checkbox" v-model="ekuServerAuth" :disabled="isProcessing" /><span>服务器身份验证 <em>serverAuth</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuClientAuth" :disabled="isProcessing" /><span>客户端身份验证 <em>clientAuth</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuCodeSigning" :disabled="isProcessing" /><span>代码签名 <em>codeSigning</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuEmailProtection" :disabled="isProcessing" /><span>邮件保护 <em>emailProtection</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuTimeStamping" :disabled="isProcessing" /><span>时间戳 <em>timeStamping</em></span></label>
        </div>
      </div>
      <div class="adv-block ca-block" :class="{ 'ca-on': isCA }">
        <label class="ca-toggle">
          <input type="checkbox" v-model="isCA" :disabled="isProcessing" />
          <span>签为 CA 证书</span>
        </label>
        <p class="adv-hint">签为 CA 后，该证书可对他人的 CSR 进行签名</p>
      </div>
    </div>

    <div v-if="errorMsg" class="error-bar">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <div class="action-bar">
      <button @click="sign" class="btn-primary" :disabled="isProcessing">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '签发中...' : '📜 签发证书' }}
      </button>
      <button v-if="resultCert" @click="reset" class="btn-reset">重置</button>
    </div>

    <div v-if="resultCert" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          签发成功
        </span>
        <div class="result-actions">
          <button @click="copy(resultCert)" class="btn-copy">复制</button>
          <button @click="download(resultCert, 'cert.pem')" class="btn-dl">下载 .pem</button>
        </div>
      </div>
      <pre>{{ resultCert }}</pre>
    </div>
  </div>
</template>

<style scoped>
.sc-tool { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.req { color: #f44336; }
.pem-box { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff; }
.pem-box:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.pem-tabs { display: flex; align-items: center; background: #f7f8fa; border-bottom: 1px solid #e8e8e8; }
.pem-tab { padding: 7px 14px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #777; border-bottom: 2px solid transparent; transition: all .15s; display: flex; align-items: center; gap: 4px; }
.pem-tab:hover:not(:disabled) { color: #333; background: #efefef; }
.pem-tab.active { color: #2196F3; border-bottom-color: #2196F3; background: #fff; font-weight: 500; }
.pem-tab:disabled { opacity: .45; cursor: not-allowed; }
.upload-btn { margin-left: auto; display: flex; align-items: center; gap: 4px; padding: 5px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #2196F3; transition: background .15s; }
.upload-btn:hover:not(:disabled) { background: #e3f2fd; }
.upload-btn:disabled { opacity: .45; cursor: not-allowed; }
.pem-box textarea { display: block; width: 100%; padding: 10px 12px; border: none; outline: none; resize: vertical; font-size: 11.5px; font-family: monospace; line-height: 1.6; box-sizing: border-box; min-height: 90px; }
.dot { width: 6px; height: 6px; border-radius: 50%; background: #4CAF50; display: inline-block; }
.day-buttons { display: flex; flex-wrap: wrap; gap: 5px; }
.day-btn { padding: 4px 10px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all .15s; }
.day-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
.day-btn.active { background: #2196F3; color: #fff; border-color: #2196F3; font-weight: 500; }
.day-btn:disabled { opacity: .45; cursor: not-allowed; }
.adv-block { border: 1px solid #eee; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; background: #fafafa; }
.adv-header { display: flex; justify-content: space-between; align-items: center; }
.adv-label { font-size: 12px; font-weight: 500; color: #444; }
.adv-hint { font-size: 11px; color: #aaa; margin: 4px 0 0; }
.sw { display: flex; align-items: center; gap: 5px; cursor: pointer; font-size: 12px; color: #666; }
.cb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px; }
.cb-item { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: background .1s; font-size: 12px; }
.cb-item:hover { background: #f0f0f0; }
.cb-item em { font-style: normal; color: #aaa; font-size: 11px; margin-left: 2px; }
.ca-block { border-color: #ffe082; background: #fffde7; }
.ca-block.ca-on { border-color: #FFC107; background: #fff8e1; }
.ca-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px; font-weight: 500; color: #5d4037; }
.ca-toggle input { width: 15px; height: 15px; accent-color: #FFC107; }
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
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 200px; }
</style>
