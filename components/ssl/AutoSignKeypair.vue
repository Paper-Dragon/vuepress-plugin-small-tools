<script setup>
import { ref } from 'vue'

// CA 输入
const caActiveTab = ref('cert')
const caCertPem = ref('')
const caKeyPem = ref('')

// 新证书参数
const keyType = ref('RSA')
const rsaKeySize = ref(2048)
const ecCurve = ref('P-256')
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
const resultPrivKey = ref('')
const resultCert = ref('')
const errorMsg = ref('')
const isProcessing = ref(false)

const validityOptions = [7, 30, 60, 90, 180, 365, 730, 3650]
const rsaSizes = [1024, 2048, 4096]
const ecCurves = ['P-256', 'P-384', 'P-521']

// ---- 文件上传 ----
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
function seq(...c) { return tlv(0x30, ...c) }
function set_(...c) { return tlv(0x31, ...c) }
function oid(bytes) { return tlv(0x06, new Uint8Array(bytes)) }
function utf8str(s) { return tlv(0x0C, new TextEncoder().encode(s)) }
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

const OID_SHA256_RSA  = [0x2A,0x86,0x48,0x86,0xF7,0x0D,0x01,0x01,0x0B]
const OID_ECDSA_SHA256= [0x2A,0x86,0x48,0xCE,0x3D,0x04,0x03,0x02]
const OID_CN          = [0x55,0x04,0x03]
const OID_SAN         = [0x55,0x1D,0x11]
const OID_KEY_USAGE   = [0x55,0x1D,0x0F]
const OID_BC          = [0x55,0x1D,0x13]
const OID_EKU         = [0x55,0x1D,0x25]
const OID_EKU_SERVER  = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x01]
const OID_EKU_CLIENT  = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x02]
const OID_EKU_CODE    = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x03]
const OID_EKU_EMAIL   = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x04]
const OID_EKU_TIME    = [0x2B,0x06,0x01,0x05,0x05,0x07,0x03,0x08]

function pemToBytes(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  return new Uint8Array(atob(b64).split('').map(c => c.charCodeAt(0)))
}
function bytesToPem(bytes, label) {
  const b64 = btoa(String.fromCharCode(...bytes))
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n-----END ${label}-----`
}

function readTLV(buf, offset) {
  const tag = buf[offset]
  let lenOff = offset + 1, len
  if (buf[lenOff] < 128) { len = buf[lenOff]; lenOff++ }
  else if (buf[lenOff] === 0x81) { len = buf[lenOff+1]; lenOff += 2 }
  else { len = (buf[lenOff+1] << 8) | buf[lenOff+2]; lenOff += 3 }
  return { tag, start: offset, end: lenOff + len, valueStart: lenOff, len }
}

function extractSubjectFromCert(der) {
  const certSeq = readTLV(der, 0)
  const tbsSeq  = readTLV(der, certSeq.valueStart)
  let cur = tbsSeq.valueStart
  if (der[cur] === 0xA0) { cur = readTLV(der, cur).end }
  cur = readTLV(der, cur).end  // serial
  cur = readTLV(der, cur).end  // sigAlg
  const issuer = readTLV(der, cur)
  return der.slice(issuer.start, issuer.end)
}

function buildExtensions(sanList, kuBits, ekuOids, caFlag) {
  const exts = []
  exts.push(seq(oid(OID_BC), bool(true), octetstr(caFlag ? seq(bool(true)) : seq())))
  if (kuBits !== null) {
    const b1 = (kuBits >> 1) & 0xFF, b2 = (kuBits & 1) << 7
    const kuBytes = b2 === 0 ? new Uint8Array([b1]) : new Uint8Array([b1, b2])
    exts.push(seq(oid(OID_KEY_USAGE), bool(true), octetstr(bitstr(kuBytes, b2 === 0 ? 1 : 0))))
  }
  if (ekuOids && ekuOids.length > 0)
    exts.push(seq(oid(OID_EKU), octetstr(seq(...ekuOids.map(o => oid(o))))))
  if (sanList && sanList.length > 0) {
    const entries = sanList.map(s =>
      /^\d+\.\d+\.\d+\.\d+$/.test(s)
        ? tlv(0x87, new Uint8Array(s.split('.').map(Number)))
        : tlv(0x82, new TextEncoder().encode(s))
    )
    exts.push(seq(oid(OID_SAN), octetstr(seq(...entries))))
  }
  return ctx(3, seq(...exts))
}

async function generate() {
  errorMsg.value = ''
  resultPrivKey.value = ''
  resultCert.value = ''

  if (!caCertPem.value.trim()) { errorMsg.value = '请输入 CA 证书'; return }
  if (!caKeyPem.value.trim())  { errorMsg.value = '请输入 CA 私钥'; return }
  if (!commonName.value.trim()) { errorMsg.value = '请输入通用名称 (CN)'; return }

  isProcessing.value = true
  try {
    // 1. 生成新密钥对
    let newKp, sigAlgOid, sigAlgSeq
    if (keyType.value === 'RSA') {
      newKp = await crypto.subtle.generateKey(
        { name: 'RSASSA-PKCS1-v1_5', modulusLength: rsaKeySize.value, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
        true, ['sign', 'verify']
      )
      sigAlgOid = OID_SHA256_RSA
      sigAlgSeq = seq(oid(sigAlgOid), tlv(0x05))
    } else {
      const namedCurveOidMap = {
        'P-256': [0x2A,0x86,0x48,0xCE,0x3D,0x03,0x01,0x07],
        'P-384': [0x2B,0x81,0x04,0x00,0x22],
        'P-521': [0x2B,0x81,0x04,0x00,0x23],
      }
      newKp = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: ecCurve.value },
        true, ['sign', 'verify']
      )
      sigAlgOid = OID_ECDSA_SHA256
      sigAlgSeq = seq(oid(sigAlgOid))
    }

    // 2. 导出新私钥
    const privKeyBuf = await crypto.subtle.exportKey('pkcs8', newKp.privateKey)
    resultPrivKey.value = bytesToPem(new Uint8Array(privKeyBuf), 'PRIVATE KEY')

    // 3. 导出新公钥 SPKI
    const spkiBuf = await crypto.subtle.exportKey('spki', newKp.publicKey)
    const spkiBytes = new Uint8Array(spkiBuf)

    // 4. 导入 CA 私钥（用于签名）
    const caKeyDer = pemToBytes(caKeyPem.value)
    // 尝试 RSA，失败则尝试 ECDSA
    let caKey
    try {
      caKey = await crypto.subtle.importKey('pkcs8', caKeyDer,
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
    } catch {
      caKey = await crypto.subtle.importKey('pkcs8', caKeyDer,
        { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }, false, ['sign'])
    }

    // 5. 从 CA 证书提取 Issuer
    const caCertDer = pemToBytes(caCertPem.value)
    const issuerBytes = extractSubjectFromCert(caCertDer)

    // 6. 构建 Subject
    const subjectBytes = seq(set_(seq(oid(OID_CN), utf8str(commonName.value))))

    // 7. 有效期
    const now = Math.floor(Date.now() / 1000)
    const validity = seq(utctime(now), utctime(now + validityDays.value * 86400))

    // 8. 密钥用法
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

    // 9. EKU
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

    // 10. SAN
    const sanList = sanText.value.split(/[\n,]/).map(s => s.trim()).filter(Boolean)

    // 11. TBSCertificate（签名算法用 CA 的算法，这里统一用 SHA256WithRSA/ECDSA）
    const tbs = seq(
      ctx(0, integer(2)),
      integer(Math.floor(Math.random() * 0x7FFFFFFF) + 1),
      sigAlgSeq,
      issuerBytes,
      validity,
      subjectBytes,
      spkiBytes,
      buildExtensions(sanList, kuBits, ekuOids, isCA.value)
    )

    // 12. CA 签名
    let sig
    try {
      sig = await crypto.subtle.sign({ name: 'RSASSA-PKCS1-v1_5' }, caKey, tbs)
    } catch {
      sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, caKey, tbs)
    }

    // 13. 组装证书
    const cert = seq(tbs, sigAlgSeq, bitstr(new Uint8Array(sig), 0))
    resultCert.value = bytesToPem(cert, 'CERTIFICATE')
  } catch (e) {
    errorMsg.value = '生成失败: ' + e.message
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
  caCertPem.value = ''; caKeyPem.value = ''; commonName.value = ''
  sanText.value = ''; validityDays.value = 365; isCA.value = false
  customKeyUsage.value = false; customEKU.value = false
  resultPrivKey.value = ''; resultCert.value = ''; errorMsg.value = ''
}
</script>

<template>
  <div class="ask-tool">

    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">⚡</span>
      <div>
        <div class="tool-name">Auto Sign With Keypair</div>
        <div class="tool-desc">自动生成密钥对，并使用 CA 证书签发 X.509 证书</div>
      </div>
    </div>

    <!-- CA 证书 / 私钥 -->
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
        <textarea v-if="caActiveTab === 'cert'" v-model="caCertPem"
          placeholder="-----BEGIN CERTIFICATE-----&#10;粘贴 CA 证书 PEM，或点击右上角上传文件&#10;-----END CERTIFICATE-----"
          rows="5" :disabled="isProcessing"></textarea>
        <textarea v-else v-model="caKeyPem"
          placeholder="-----BEGIN PRIVATE KEY-----&#10;粘贴 CA 私钥 PEM，或点击右上角上传文件&#10;-----END PRIVATE KEY-----"
          rows="5" :disabled="isProcessing"></textarea>
      </div>
    </div>

    <!-- 新密钥参数 -->
    <div class="section">
      <div class="section-title">新密钥参数</div>
      <div class="form-row">
        <div class="field">
          <label>密钥类型</label>
          <div class="seg-ctrl">
            <button :class="['seg-btn', { active: keyType === 'RSA' }]" @click="keyType = 'RSA'" :disabled="isProcessing">RSA</button>
            <button :class="['seg-btn', { active: keyType === 'EC' }]" @click="keyType = 'EC'" :disabled="isProcessing">EC (椭圆曲线)</button>
          </div>
        </div>
        <div class="field">
          <label>{{ keyType === 'RSA' ? '密钥长度' : '曲线' }}</label>
          <div class="seg-ctrl" v-if="keyType === 'RSA'">
            <button v-for="s in rsaSizes" :key="s"
              :class="['seg-btn', { active: rsaKeySize === s }]"
              @click="rsaKeySize = s" :disabled="isProcessing">{{ s }}</button>
          </div>
          <div class="seg-ctrl" v-else>
            <button v-for="c in ecCurves" :key="c"
              :class="['seg-btn', { active: ecCurve === c }]"
              @click="ecCurve = c" :disabled="isProcessing">{{ c }}</button>
          </div>
        </div>
      </div>
    </div>

    <!-- 证书信息 -->
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

    <!-- 高级选项 -->
    <div class="section">
      <div class="section-title">高级选项</div>

      <div class="adv-block">
        <div class="adv-header">
          <span class="adv-label">密钥用法 (Key Usage)</span>
          <label class="switch-label"><input type="checkbox" v-model="customKeyUsage" :disabled="isProcessing" /><span class="switch-text">自定义</span></label>
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

      <div class="adv-block">
        <div class="adv-header">
          <span class="adv-label">增强型密钥用法 (EKU)</span>
          <label class="switch-label"><input type="checkbox" v-model="customEKU" :disabled="isProcessing" /><span class="switch-text">自定义</span></label>
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

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作 -->
    <div class="action-bar">
      <button @click="generate" class="btn-sign" :disabled="isProcessing">
        <span v-if="isProcessing" class="spinner"></span>
        {{ isProcessing ? '生成中...' : '⚡ 生成并签发' }}
      </button>
      <button v-if="resultCert" @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="resultCert" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          生成成功
        </span>
      </div>

      <div class="result-item">
        <div class="result-item-header">
          <span>私钥</span>
          <div class="result-actions">
            <button @click="copy(resultPrivKey)" class="btn-copy">复制</button>
            <button @click="download(resultPrivKey, 'private.key')" class="btn-download">下载 .key</button>
          </div>
        </div>
        <pre>{{ resultPrivKey }}</pre>
      </div>

      <div class="result-item">
        <div class="result-item-header">
          <span>证书</span>
          <div class="result-actions">
            <button @click="copy(resultCert)" class="btn-copy">复制</button>
            <button @click="download(resultCert, 'cert.pem')" class="btn-download">下载 .pem</button>
          </div>
        </div>
        <pre>{{ resultCert }}</pre>
      </div>
    </div>

  </div>
</template>

<style scoped>
.ask-tool { padding: 16px; font-size: 13px; color: #333; }

.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; line-height: 1; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }

.section { margin-bottom: 16px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }

.pem-box { border: 1px solid #e0e0e0; border-radius: 6px; overflow: hidden; background: #fff; transition: border-color 0.15s; }
.pem-box:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,0.1); }
.pem-tabs { display: flex; align-items: center; background: #f7f8fa; border-bottom: 1px solid #e8e8e8; }
.pem-tab { padding: 7px 14px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #777; border-bottom: 2px solid transparent; transition: all 0.15s; display: flex; align-items: center; gap: 4px; }
.pem-tab:hover:not(:disabled) { color: #333; background: #efefef; }
.pem-tab.active { color: #2196F3; border-bottom-color: #2196F3; background: #fff; font-weight: 500; }
.pem-tab:disabled { opacity: 0.45; cursor: not-allowed; }
.pem-upload-btn { margin-left: auto; display: flex; align-items: center; gap: 5px; padding: 5px 12px; border: none; background: transparent; cursor: pointer; font-size: 12px; color: #2196F3; transition: background 0.15s; }
.pem-upload-btn:hover:not(:disabled) { background: #e3f2fd; }
.pem-upload-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.pem-box textarea { display: block; width: 100%; padding: 10px 12px; border: none; outline: none; resize: vertical; font-size: 11.5px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; color: #333; background: #fff; box-sizing: border-box; min-height: 100px; }
.filled-dot { width: 6px; height: 6px; border-radius: 50%; background: #4CAF50; display: inline-block; }

.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field label { font-size: 12px; font-weight: 500; color: #555; }
.field input { padding: 7px 10px; border: 1px solid #e0e0e0; border-radius: 5px; font-size: 12px; font-family: monospace; box-sizing: border-box; outline: none; transition: border-color 0.15s; }
.field input:focus { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,0.1); }
.req { color: #f44336; }

/* 分段控制器 */
.seg-ctrl { display: flex; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; }
.seg-btn { flex: 1; padding: 6px 10px; border: none; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all 0.15s; border-right: 1px solid #e0e0e0; }
.seg-btn:last-child { border-right: none; }
.seg-btn:hover:not(:disabled) { background: #f0f0f0; }
.seg-btn.active { background: #2196F3; color: #fff; font-weight: 500; }
.seg-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.day-buttons { display: flex; flex-wrap: wrap; gap: 5px; }
.day-btn { padding: 4px 10px; border: 1px solid #e0e0e0; border-radius: 4px; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all 0.15s; }
.day-btn:hover:not(:disabled) { border-color: #2196F3; color: #2196F3; }
.day-btn.active { background: #2196F3; color: #fff; border-color: #2196F3; font-weight: 500; }
.day-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.adv-block { border: 1px solid #eee; border-radius: 6px; padding: 10px 12px; margin-bottom: 8px; background: #fafafa; }
.adv-header { display: flex; justify-content: space-between; align-items: center; }
.adv-label { font-size: 12px; font-weight: 500; color: #444; }
.adv-hint { font-size: 11px; color: #aaa; margin: 4px 0 0 0; }
.switch-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 12px; color: #666; }
.switch-text { user-select: none; }

.checkbox-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px; }
.cb-item { display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: background 0.1s; }
.cb-item:hover { background: #f0f0f0; }
.cb-item span { font-size: 12px; color: #444; }
.cb-item em { font-style: normal; color: #aaa; font-size: 11px; margin-left: 3px; }

.ca-block { border-color: #ffe082; background: #fffde7; transition: all 0.2s; }
.ca-block.ca-active { border-color: #FFC107; background: #fff8e1; }
.ca-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.ca-toggle input { width: 15px; height: 15px; accent-color: #FFC107; }
.ca-toggle-text { font-size: 13px; font-weight: 500; color: #5d4037; }

.error-bar { display: flex; align-items: center; gap: 6px; background: #fdecea; color: #c62828; padding: 8px 12px; border-radius: 5px; font-size: 12px; margin-bottom: 10px; border: 1px solid #f5c6cb; }

.action-bar { display: flex; gap: 8px; margin: 14px 0 0 0; }
.btn-sign { flex: 1; padding: 10px 20px; background: #2196F3; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background 0.15s; box-shadow: 0 1px 3px rgba(33,150,243,0.3); }
.btn-sign:hover:not(:disabled) { background: #1976D2; }
.btn-sign:disabled { background: #90CAF9; cursor: not-allowed; box-shadow: none; }
.btn-reset { padding: 10px 18px; background: #fff; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; transition: all 0.15s; }
.btn-reset:hover { background: #f5f5f5; border-color: #bbb; }

.spinner { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.result-block { margin-top: 14px; border: 1px solid #c8e6c9; border-radius: 6px; overflow: hidden; }
.result-header { display: flex; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.result-item { border-top: 1px solid #e8f5e9; }
.result-item:first-of-type { border-top: none; }
.result-item-header { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; background: #f9fbe7; font-size: 12px; font-weight: 500; color: #555; }
.result-actions { display: flex; gap: 6px; }
.btn-copy { padding: 4px 12px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 4px; cursor: pointer; font-size: 11px; transition: all 0.15s; }
.btn-copy:hover { background: #e3f2fd; }
.btn-download { padding: 4px 12px; background: #4CAF50; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; transition: background 0.15s; }
.btn-download:hover { background: #388E3C; }
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 180px; }
</style>
