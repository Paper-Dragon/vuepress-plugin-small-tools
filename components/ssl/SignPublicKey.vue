<script setup>
import { ref } from 'vue'

// CA 输入区 tab
const caActiveTab = ref('cert') // 'cert' | 'key'
const caCertPem = ref('')
const caKeyPem = ref('')

function loadFile(targetRef) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.pem,.crt,.cer,.key,.txt'
  input.onchange = () => {
    const file = input.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => { targetRef.value = e.target.result.trim() }
    reader.readAsText(file)
  }
  input.click()
}
const pubKeyPem = ref('')
const commonName = ref('')
const validityDays = ref(365)
const sanText = ref('')
const isCA = ref(false)

// 密钥用法
const customKeyUsage = ref(false)
const kuDigitalSignature = ref(false)
const kuContentCommitment = ref(false)
const kuKeyEncipherment = ref(false)
const kuDataEncipherment = ref(false)
const kuKeyAgreement = ref(false)
const kuKeyCertSign = ref(false)
const kuCRLSign = ref(false)

// 增强型密钥用法
const customEKU = ref(false)
const ekuServerAuth = ref(false)
const ekuClientAuth = ref(false)
const ekuCodeSigning = ref(false)
const ekuEmailProtection = ref(false)
const ekuTimeStamping = ref(false)

// 输出
const resultCert = ref('')
const errorMsg = ref('')
const isProcessing = ref(false)

const validityOptions = [7, 30, 60, 90, 180, 365, 730, 3650]

// ---- ASN.1 工具 ----
function encLen(len) {
  if (len < 128) return new Uint8Array([len])
  if (len < 256) return new Uint8Array([0x81, len])
  return new Uint8Array([0x82, (len >> 8) & 0xFF, len & 0xFF])
}

function tlv(tag, ...contents) {
  const body = concat(...contents)
  return concat(new Uint8Array([tag]), encLen(body.length), body)
}

function concat(...arrays) {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let off = 0
  for (const a of arrays) { out.set(a, off); off += a.length }
  return out
}

function seq(...contents) { return tlv(0x30, ...contents) }
function set_(...contents) { return tlv(0x31, ...contents) }
function oid(bytes) { return tlv(0x06, new Uint8Array(bytes)) }
function utf8str(s) { const b = new TextEncoder().encode(s); return tlv(0x0C, b) }
function printstr(s) { const b = new TextEncoder().encode(s); return tlv(0x13, b) }
function ia5str(s) { const b = new TextEncoder().encode(s); return tlv(0x16, b) }
function integer(n) {
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex
  const bytes = hex.match(/.{2}/g).map(b => parseInt(b, 16))
  if (bytes[0] & 0x80) bytes.unshift(0)
  return tlv(0x02, new Uint8Array(bytes))
}
function utctime(ts) {
  const d = new Date(ts * 1000)
  const s = `${String(d.getUTCFullYear()).slice(-2)}${pad(d.getUTCMonth()+1)}${pad(d.getUTCDate())}${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  return tlv(0x17, new TextEncoder().encode(s))
}
function pad(n) { return String(n).padStart(2, '0') }
function bitstr(bytes, unusedBits = 0) { return tlv(0x03, new Uint8Array([unusedBits]), bytes) }
function ctx(n, ...contents) { return tlv(0xA0 | n, ...contents) }
function bool(v) { return tlv(0x01, new Uint8Array([v ? 0xFF : 0x00])) }
function octetstr(bytes) { return tlv(0x04, bytes) }

// OID 常量
const OID_RSA = [0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x01]
const OID_SHA256_RSA = [0x2A, 0x86, 0x48, 0x86, 0xF7, 0x0D, 0x01, 0x01, 0x0B]
const OID_CN = [0x55, 0x04, 0x03]
const OID_SAN = [0x55, 0x1D, 0x11]
const OID_KEY_USAGE = [0x55, 0x1D, 0x0F]
const OID_BASIC_CONSTRAINTS = [0x55, 0x1D, 0x13]
const OID_EKU = [0x55, 0x1D, 0x25]
const OID_EKU_SERVER = [0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x01]
const OID_EKU_CLIENT = [0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x02]
const OID_EKU_CODE = [0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x03]
const OID_EKU_EMAIL = [0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x04]
const OID_EKU_TIME = [0x2B, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x08]

// PEM 解析
function pemToBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const bin = atob(b64)
  return new Uint8Array(bin.split('').map(c => c.charCodeAt(0)))
}

function bytesToPem(bytes, label) {
  const b64 = btoa(String.fromCharCode(...bytes))
  const lines = b64.match(/.{1,64}/g).join('\n')
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`
}

// 从 DER 证书中提取 Subject（原始字节）
function extractSubjectFromCert(certDer) {
  // TBSCertificate 在 SEQUENCE > SEQUENCE
  // 结构: SEQUENCE { SEQUENCE { [0] version, INTEGER serial, SEQUENCE algId, SEQUENCE issuer, SEQUENCE validity, SEQUENCE subject, ... } }
  let off = 0
  function readTLV(buf, offset) {
    const tag = buf[offset]
    let lenOff = offset + 1
    let len
    if (buf[lenOff] < 128) { len = buf[lenOff]; lenOff++ }
    else if (buf[lenOff] === 0x81) { len = buf[lenOff+1]; lenOff += 2 }
    else { len = (buf[lenOff+1] << 8) | buf[lenOff+2]; lenOff += 3 }
    return { tag, start: offset, headerLen: lenOff - offset, len, end: lenOff + len, valueStart: lenOff }
  }

  const certSeq = readTLV(certDer, 0)
  const tbsSeq = readTLV(certDer, certSeq.valueStart)
  let cursor = tbsSeq.valueStart

  // skip version [0] if present
  if (certDer[cursor] === 0xA0) { const t = readTLV(certDer, cursor); cursor = t.end }
  // skip serial
  const serial = readTLV(certDer, cursor); cursor = serial.end
  // skip signature alg
  const sigAlg = readTLV(certDer, cursor); cursor = sigAlg.end
  // issuer = subject of CA cert
  const issuer = readTLV(certDer, cursor)
  return certDer.slice(issuer.start, issuer.end)
}

// 从 DER 证书中提取 SubjectPublicKeyInfo
function extractSPKIFromCert(certDer) {
  function readTLV(buf, offset) {
    const tag = buf[offset]
    let lenOff = offset + 1
    let len
    if (buf[lenOff] < 128) { len = buf[lenOff]; lenOff++ }
    else if (buf[lenOff] === 0x81) { len = buf[lenOff+1]; lenOff += 2 }
    else { len = (buf[lenOff+1] << 8) | buf[lenOff+2]; lenOff += 3 }
    return { tag, start: offset, headerLen: lenOff - offset, len, end: lenOff + len, valueStart: lenOff }
  }
  const certSeq = readTLV(certDer, 0)
  const tbsSeq = readTLV(certDer, certSeq.valueStart)
  let cursor = tbsSeq.valueStart
  if (certDer[cursor] === 0xA0) { const t = readTLV(certDer, cursor); cursor = t.end }
  const serial = readTLV(certDer, cursor); cursor = serial.end
  const sigAlg = readTLV(certDer, cursor); cursor = sigAlg.end
  const issuer = readTLV(certDer, cursor); cursor = issuer.end
  const validity = readTLV(certDer, cursor); cursor = validity.end
  const subject = readTLV(certDer, cursor); cursor = subject.end
  const spki = readTLV(certDer, cursor)
  return certDer.slice(spki.start, spki.end)
}

// 构建扩展
function buildExtensions(sanList, kuBits, ekuOids, caFlag) {
  const exts = []

  // Basic Constraints
  const bcValue = caFlag
    ? seq(bool(true))
    : seq()
  exts.push(seq(oid(OID_BASIC_CONSTRAINTS), bool(true), octetstr(bcValue)))

  // Key Usage
  if (kuBits !== null) {
    // kuBits: 9-bit value, bit 0 = digitalSignature (MSB first)
    const byte1 = (kuBits >> 1) & 0xFF
    const byte2 = (kuBits & 1) << 7
    const unused = byte2 === 0 ? 1 : 0
    const kuBytes = byte2 === 0
      ? new Uint8Array([byte1])
      : new Uint8Array([byte1, byte2])
    const kuVal = bitstr(kuBytes, unused)
    exts.push(seq(oid(OID_KEY_USAGE), bool(true), octetstr(kuVal)))
  }

  // EKU
  if (ekuOids && ekuOids.length > 0) {
    const ekuSeq = seq(...ekuOids.map(o => oid(o)))
    exts.push(seq(oid(OID_EKU), octetstr(ekuSeq)))
  }

  // SAN
  if (sanList && sanList.length > 0) {
    const sanEntries = sanList.map(s => {
      // IP address check
      if (/^\d+\.\d+\.\d+\.\d+$/.test(s)) {
        const parts = s.split('.').map(Number)
        return tlv(0x87, new Uint8Array(parts))
      }
      // DNS
      return tlv(0x82, new TextEncoder().encode(s))
    })
    const sanSeq = seq(...sanEntries)
    exts.push(seq(oid(OID_SAN), octetstr(sanSeq)))
  }

  return ctx(3, seq(...exts))
}

async function sign() {
  errorMsg.value = ''
  resultCert.value = ''

  if (!caCertPem.value.trim()) { errorMsg.value = '请输入CA证书'; return }
  if (!caKeyPem.value.trim()) { errorMsg.value = '请输入CA私钥'; return }
  if (!pubKeyPem.value.trim()) { errorMsg.value = '请输入待签名公钥'; return }
  if (!commonName.value.trim()) { errorMsg.value = '请输入通用名称 (CN)'; return }

  isProcessing.value = true
  try {
    // 解析 CA 私钥
    const caKeyDer = pemToBytes(caKeyPem.value)
    const caKey = await crypto.subtle.importKey(
      'pkcs8', caKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    )

    // 解析 CA 证书，提取 Subject 作为新证书的 Issuer
    const caCertDer = pemToBytes(caCertPem.value)
    const issuerBytes = extractSubjectFromCert(caCertDer)

    // 解析待签名公钥 -> SPKI
    let spkiBytes
    const pubTrimmed = pubKeyPem.value.trim()
    if (pubTrimmed.includes('CERTIFICATE')) {
      // 如果粘贴的是证书，提取其 SPKI
      spkiBytes = extractSPKIFromCert(pemToBytes(pubTrimmed))
    } else {
      // 公钥 PEM (SPKI 格式)
      spkiBytes = pemToBytes(pubTrimmed)
    }

    // 构建 Subject
    const subjectBytes = seq(set_(seq(oid(OID_CN), utf8str(commonName.value))))

    // 时间
    const now = Math.floor(Date.now() / 1000)
    const validity = seq(utctime(now), utctime(now + validityDays.value * 86400))

    // 序列号
    const sn = Math.floor(Math.random() * 0x7FFFFFFF) + 1

    // 密钥用法 bits
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
      // 自动：CA 用 keyCertSign+cRLSign，普通用 digitalSignature+keyEncipherment
      kuBits = isCA.value ? ((1 << 3) | (1 << 2)) : ((1 << 8) | (1 << 6))
    }

    // EKU OIDs
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

    // SAN
    const sanList = sanText.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean)

    // 签名算法
    const sigAlgSeq = seq(oid(OID_SHA256_RSA), tlv(0x05))

    // TBSCertificate
    const tbs = seq(
      ctx(0, integer(2)),          // version v3
      integer(sn),                  // serialNumber
      sigAlgSeq,                    // signature
      issuerBytes,                  // issuer (from CA cert subject)
      validity,                     // validity
      subjectBytes,                 // subject
      spkiBytes,                    // subjectPublicKeyInfo
      buildExtensions(sanList, kuBits, ekuOids, isCA.value)
    )

    // 签名
    const sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, caKey, tbs)
    const sigBytes = new Uint8Array(sig)

    // 完整证书
    const cert = seq(
      tbs,
      sigAlgSeq,
      bitstr(sigBytes, 0)
    )

    resultCert.value = bytesToPem(cert, 'CERTIFICATE')
  } catch (e) {
    errorMsg.value = '签发失败: ' + e.message
    console.error(e)
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
  caCertPem.value = ''; caKeyPem.value = ''; pubKeyPem.value = ''
  commonName.value = ''; sanText.value = ''; validityDays.value = 365; isCA.value = false
  customKeyUsage.value = false; customEKU.value = false; resultCert.value = ''; errorMsg.value = ''
}
</script>

<template>
  <div class="spk-tool">

    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🔏</span>
      <div>
        <div class="tool-name">Sign Public Key</div>
        <div class="tool-desc">使用 CA 证书与私钥对公钥进行签名，签发 X.509 证书</div>
      </div>
    </div>

    <!-- Section: CA 信息 -->
    <div class="section">
      <div class="section-title">CA 证书 / 私钥</div>
      <div class="pem-box">
        <div class="pem-tabs">
          <button :class="['pem-tab', { active: caActiveTab === 'cert' }]" @click="caActiveTab = 'cert'" :disabled="isProcessing">
            CA 证书 <span class="req">*</span>
            <span v-if="caCertPem" class="filled-dot"></span>
          </button>
          <button :class="['pem-tab', { active: caActiveTab === 'key' }]" @click="caActiveTab = 'key'" :disabled="isProcessing">
            CA 私钥 <span class="req">*</span>
            <span v-if="caKeyPem" class="filled-dot"></span>
          </button>
          <button class="pem-upload-btn" @click="loadFile(caActiveTab === 'cert' ? caCertPem : caKeyPem)" :disabled="isProcessing">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            上传文件
          </button>
        </div>
        <textarea
          v-if="caActiveTab === 'cert'"
          v-model="caCertPem"
          placeholder="-----BEGIN CERTIFICATE-----&#10;粘贴 CA 证书 PEM 内容，或点击右上角上传文件&#10;-----END CERTIFICATE-----"
          rows="5" :disabled="isProcessing"
        ></textarea>
        <textarea
          v-else
          v-model="caKeyPem"
          placeholder="-----BEGIN PRIVATE KEY-----&#10;粘贴 CA 私钥 PEM 内容，或点击右上角上传文件&#10;-----END PRIVATE KEY-----"
          rows="5" :disabled="isProcessing"
        ></textarea>
      </div>
    </div>

    <!-- Section: 待签名公钥 -->
    <div class="section">
      <div class="section-title">待签名公钥 <span class="req">*</span></div>
      <div class="field-hint">支持 PUBLIC KEY 或直接粘贴证书（将提取其公钥）</div>
      <div class="pem-box single">
        <div class="pem-tabs">
          <span class="pem-tab active" style="pointer-events:none">公钥 / 证书</span>
          <button class="pem-upload-btn" @click="loadFile(pubKeyPem)" :disabled="isProcessing">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            上传文件
          </button>
        </div>
        <textarea
          v-model="pubKeyPem"
          placeholder="-----BEGIN PUBLIC KEY-----&#10;粘贴待签名公钥，或点击右上角上传文件&#10;-----END PUBLIC KEY-----"
          rows="5" :disabled="isProcessing"
        ></textarea>
      </div>
    </div>

    <!-- Section: 证书信息 -->
    <div class="section">
      <div class="section-title">证书信息</div>
      <div class="form-row">
        <div class="field">
          <label>通用名称 (CN) <span class="req">*</span></label>
          <input v-model="commonName" placeholder="example.com" :disabled="isProcessing" />
        </div>
        <div class="field">
          <label>SAN 备用名称</label>
          <input v-model="sanText" placeholder="example.com, *.example.com, 192.168.1.1" :disabled="isProcessing" />
        </div>
      </div>
      <div class="field">
        <label>有效天数</label>
        <div class="day-buttons">
          <button v-for="d in validityOptions" :key="d"
            :class="['day-btn', { active: validityDays === d }]"
            @click="validityDays = d" :disabled="isProcessing">{{ d }}</button>
        </div>
      </div>
    </div>

    <!-- Section: 高级选项 -->
    <div class="section">
      <div class="section-title">高级选项</div>

      <!-- 密钥用法 -->
      <div class="adv-block">
        <div class="adv-header">
          <span class="adv-label">密钥用法 (Key Usage)</span>
          <label class="switch-label">
            <input type="checkbox" v-model="customKeyUsage" :disabled="isProcessing" />
            <span class="switch-text">自定义</span>
          </label>
        </div>
        <p class="adv-hint">不了解时可不选，系统将自动选择合适的值</p>
        <div v-if="customKeyUsage" class="checkbox-grid">
          <label class="cb-item"><input type="checkbox" v-model="kuDigitalSignature" :disabled="isProcessing" /><span>数字签名 <em>digitalSignature</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuContentCommitment" :disabled="isProcessing" /><span>内容承诺 <em>contentCommitment</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuKeyEncipherment" :disabled="isProcessing" /><span>密钥加密 <em>keyEncipherment</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuDataEncipherment" :disabled="isProcessing" /><span>数据加密 <em>dataEncipherment</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuKeyAgreement" :disabled="isProcessing" /><span>密钥协商 <em>keyAgreement</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuKeyCertSign" :disabled="isProcessing" /><span>证书签名 <em>keyCertSign</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="kuCRLSign" :disabled="isProcessing" /><span>CRL 签名 <em>cRLSign</em></span></label>
        </div>
      </div>

      <!-- 增强型密钥用法 -->
      <div class="adv-block">
        <div class="adv-header">
          <span class="adv-label">增强型密钥用法 (EKU)</span>
          <label class="switch-label">
            <input type="checkbox" v-model="customEKU" :disabled="isProcessing" />
            <span class="switch-text">自定义</span>
          </label>
        </div>
        <p class="adv-hint">不了解时可不选，系统将自动选择合适的值</p>
        <div v-if="customEKU" class="checkbox-grid">
          <label class="cb-item"><input type="checkbox" v-model="ekuServerAuth" :disabled="isProcessing" /><span>服务器身份验证 <em>serverAuth</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuClientAuth" :disabled="isProcessing" /><span>客户端身份验证 <em>clientAuth</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuCodeSigning" :disabled="isProcessing" /><span>代码签名 <em>codeSigning</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuEmailProtection" :disabled="isProcessing" /><span>邮件保护 <em>emailProtection</em></span></label>
          <label class="cb-item"><input type="checkbox" v-model="ekuTimeStamping" :disabled="isProcessing" /><span>时间戳 <em>timeStamping</em></span></label>
        </div>
      </div>

      <!-- 签为 CA -->
      <div class="adv-block ca-block" :class="{ 'ca-active': isCA }">
        <label class="ca-toggle">
          <input type="checkbox" v-model="isCA" :disabled="isProcessing" />
          <span class="ca-toggle-text">签为 CA 证书</span>
        </label>
        <p class="adv-hint">
          签为 CA 后，该证书可对他人的 CSR 进行签名。<br/>
          可配合本工具的「自签名证书」功能生成 CA，再用此处签发下级证书。
        </p>
      </div>
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="sign" class="btn-sign" :disabled="isProcessing">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '签发中...' : '🔏 签发证书' }}
      </button>
      <button v-if="resultCert" @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="resultCert" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          签发成功
        </span>
        <div class="result-actions">
          <button @click="copy(resultCert)" class="btn-copy">复制</button>
          <button @click="download(resultCert, 'signed-cert.pem')" class="btn-download">下载 .pem</button>
        </div>
      </div>
      <pre>{{ resultCert }}</pre>
    </div>

  </div>
</template>

<style scoped>
/* ---- 整体 ---- */
.spk-tool { padding: 16px; font-size: 13px; color: #333; }

/* ---- 标题 ---- */
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; line-height: 1; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }

/* ---- Section ---- */
.section { margin-bottom: 16px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }

/* ---- PEM 输入框 ---- */
.pem-box { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff; transition: border-color 0.15s; }
.pem-box:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,0.1); }
.pem-tabs { display: flex; align-items: center; background: #f7f8fa; border-bottom: 1px solid #e8e8e8; }
.pem-tab {
  padding: 7px 14px; border: none; background: transparent; cursor: pointer;
  font-size: 12px; color: #777; border-bottom: 2px solid transparent;
  transition: all 0.15s; display: flex; align-items: center; gap: 4px;
}
.pem-tab:hover:not(:disabled) { color: #333; background: #efefef; }
.pem-tab.active { color: #2196F3; border-bottom-color: #2196F3; background: #fff; font-weight: 500; }
.pem-tab:disabled { opacity: 0.45; cursor: not-allowed; }
.pem-upload-btn {
  margin-left: auto; display: flex; align-items: center; gap: 5px;
  padding: 5px 12px; border: none; background: transparent;
  cursor: pointer; font-size: 12px; color: #2196F3; border-radius: 0;
  transition: background 0.15s;
}
.pem-upload-btn:hover:not(:disabled) { background: #e3f2fd; }
.pem-upload-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pem-box textarea {
  display: block; width: 100%; padding: 10px 12px;
  border: none; outline: none; resize: vertical;
  font-size: 11.5px; font-family: 'SFMono-Regular', Consolas, monospace;
  line-height: 1.6; color: #333; background: #fff; box-sizing: border-box;
  min-height: 100px;
}
.filled-dot { width: 6px; height: 6px; border-radius: 50%; background: #4CAF50; display: inline-block; }

/* ---- 字段 ---- */
.field-hint { font-size: 11px; color: #aaa; margin-bottom: 6px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field label { font-size: 12px; font-weight: 500; color: #555; }
.field input {
  padding: 7px 10px; border: 1px solid #e0e0e0; border-radius: 5px;
  font-size: 12px; font-family: monospace; box-sizing: border-box;
  transition: border-color 0.15s; outline: none;
}
.field input:focus { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,0.1); }
.req { color: #f44336; }

/* ---- 有效天数 ---- */
.day-buttons { display: flex; flex-wrap: wrap; gap: 5px; }
.day-btn {
  padding: 4px 10px; border: 1px solid #e0e0e0; border-radius: 4px;
  background: #fafafa; cursor: pointer; font-size: 12px; color: #555;
  transition: all 0.15s;
}
.day-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
.day-btn.active { background: #2196F3; color: #fff; border-color: #2196F3; font-weight: 500; }
.day-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ---- 高级选项块 ---- */
.adv-block { border: 1px solid #eee; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; background: #fafafa; }
.adv-header { display: flex; justify-content: space-between; align-items: center; }
.adv-label { font-size: 12px; font-weight: 500; color: #444; }
.adv-hint { font-size: 11px; color: #aaa; margin: 4px 0 0 0; }
.switch-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: #666; }
.switch-text { user-select: none; }

/* ---- checkbox 网格 ---- */
.checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px; }
.cb-item { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: background 0.1s; }
.cb-item:hover { background: #f0f0f0; }
.cb-item span { font-size: 12px; color: #444; }
.cb-item em { font-style: normal; color: #aaa; font-size: 11px; margin-left: 3px; }

/* ---- CA 块 ---- */
.ca-block { border-color: #ffe082; background: #fffde7; transition: all 0.2s; }
.ca-block.ca-active { border-color: #FFC107; background: #fff8e1; }
.ca-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.ca-toggle input { width: 15px; height: 15px; accent-color: #FFC107; }
.ca-toggle-text { font-size: 13px; font-weight: 500; color: #5d4037; }

/* ---- 错误 ---- */
.error-bar { display: flex; align-items: center; gap: 6px; background: #fdecea; color: #c62828; padding: 8px 12px; border-radius: 5px; font-size: 12px; margin-bottom: 10px; border: 1px solid #f5c6cb; }

/* ---- 操作按钮 ---- */
.action-bar { display: flex; gap: 8px; margin: 14px 0 0 0; }
.btn-sign {
  flex: 1; padding: 10px 20px; background: #2196F3; color: #fff;
  border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: background 0.15s; box-shadow: 0 1px 3px rgba(33,150,243,0.3);
}
.btn-sign:hover:not(:disabled) { background: #1976D2; }
.btn-sign:disabled { background: #90CAF9; cursor: not-allowed; box-shadow: none; }
.btn-reset { padding: 10px 18px; background: #fff; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
.btn-reset:hover { background: #f5f5f5; border-color: #bbb; }

/* ---- spinner ---- */
.spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ---- 结果 ---- */
.result-block { margin-top: 14px; border: 1px solid #c8e6c9; border-radius: 6px; overflow: hidden; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.result-actions { display: flex; gap: 6px; }
.btn-copy { padding: 4px 12px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.15s; }
.btn-copy:hover { background: #e3f2fd; }
.btn-download { padding: 4px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; transition: background 0.15s; }
.btn-download:hover { background: #388E3C; }
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 220px; }
</style>
