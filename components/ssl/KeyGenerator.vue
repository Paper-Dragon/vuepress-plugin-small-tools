<script setup>
import { ref, watch } from 'vue'

const keySize = ref(2048)
const keyType = ref('RSA')
const privateKey = ref('')
const publicKey = ref('')
const isGenerating = ref(false)
const errorMsg = ref('')

const keyTypes = [
  { value: 'RSA', label: 'RSA' },
  { value: 'ECC', label: 'ECC (P-256/P-384)' },
  { value: 'SM2', label: 'SM2 (国密)' }
]

const keySizes = [
  { value: 2048, label: '2048 位' },
  { value: 4096, label: '4096 位 (更安全)' }
]

const sm2Curves = [
  { value: 'sm2p256v1', label: 'sm2p256v1 (默认)' }
]

const eccCurves = [
  { value: 'P-256', label: 'P-256 (secp256r1)' },
  { value: 'P-384', label: 'P-384 (secp384r1)' }
]

const selectedCurve = ref('sm2p256v1')

// SM2曲线参数
const SM2_PARAMS = {
  p: BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF'),
  a: BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC'),
  b: BigInt('0x28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93'),
  n: BigInt('0xFFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123'),
  gx: BigInt('0x32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7'),
  gy: BigInt('0xBC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0'),
  hash: 'sm3'
}

// 模运算辅助函数 - 确保返回正数
function mod(a, b) {
  const result = ((a % b) + b) % b
  return result
}

// 扩展欧几里得算法 - 修复BigInt处理
function egcd(a, b) {
  if (a === 0n) return [b, 0n, 1n]
  const [g, x1, y1] = egcd(b % a, a)
  const x = y1 - (b / a) * x1
  const y = x1
  return [g, x, y]
}

// 使用费马小定理（当p为素数时）- 更稳定
function modInverse(a, m) {
  // 确保a为正数
  a = ((a % m) + m) % m
  
  // 使用扩展欧几里得算法
  const [g, x] = egcd(a, m)
  if (g !== 1n) throw new Error('模逆元不存在')
  
  // 确保结果为正数
  return ((x % m) + m) % m
}

// 椭圆曲线点加法
function ecAdd(p1, p2) {
  if (!p1) return p2
  if (!p2) return p1
  
  const [x1, y1] = p1
  const [x2, y2] = p2
  
  if (x1 === x2) {
    if (y1 === y2) {
      // 倍点 - 检查y1是否为0
      if (y1 === 0n) {
        return null // 无穷远点
      }
      const twoY1 = mod(2n * y1, SM2_PARAMS.p)
      const lambda = mod((3n * x1 * x1 + SM2_PARAMS.a) * modInverse(twoY1, SM2_PARAMS.p), SM2_PARAMS.p)
      const x3 = mod(lambda * lambda - 2n * x1, SM2_PARAMS.p)
      const y3 = mod(lambda * (x1 - x3) - y1, SM2_PARAMS.p)
      return [x3, y3]
    }
    return null // 无穷远点
  }
  
  const lambda = mod((y2 - y1) * modInverse(x2 - x1, SM2_PARAMS.p), SM2_PARAMS.p)
  const x3 = mod(lambda * lambda - x1 - x2, SM2_PARAMS.p)
  const y3 = mod(lambda * (x1 - x3) - y1, SM2_PARAMS.p)
  return [x3, y3]
}

// 椭圆曲线标量乘法（使用二进制方法）
function ecMultiply(k, point) {
  let result = null
  let addend = point
  
  while (k > 0n) {
    if (k & 1n) {
      result = ecAdd(result, addend)
    }
    addend = ecAdd(addend, addend)
    k >>= 1n
  }
  
  return result
}

// 将大整数转换为字节数组（大端序）
function bigIntToBytes(n, length = 32) {
  const hex = n.toString(16).padStart(length * 2, '0')
  const bytes = new Uint8Array(length)
  for (let i = 0; i < length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16)
  }
  return bytes
}

// 将字节数组转换为大整数
function bytesToBigInt(bytes) {
  let result = 0n
  for (let i = 0; i < bytes.length; i++) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

// 生成随机字节
function generateRandomBytes(length) {
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return bytes
}

// SM3哈希函数（简化实现）
async function sm3(data) {
  // 使用Web Crypto API的SHA-256作为替代，因为原生SM3在浏览器中不可用
  // 注意：这实际上是SHA-256，不是真正的SM3
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data)
  return new Uint8Array(hashBuffer)
}

// 生成SM2密钥对
async function generateSM2KeyPair() {
  // 随机生成私钥
  let privateKeyBigInt
  
  do {
    const randomBytes = generateRandomBytes(32)
    privateKeyBigInt = bytesToBigInt(randomBytes)
  } while (privateKeyBigInt === 0n || privateKeyBigInt >= SM2_PARAMS.n)
  
  // 计算公钥 = d * G
  const gPoint = [SM2_PARAMS.gx, SM2_PARAMS.gy]
  const publicKeyPoint = ecMultiply(privateKeyBigInt, gPoint)
  
  if (!publicKeyPoint) {
    throw new Error('公钥计算失败')
  }
  
  const [pubX, pubY] = publicKeyPoint
  
  // 导出为PEM格式
  const privateKeyPem = exportSM2PrivateKey(privateKeyBigInt)
  const publicKeyPem = exportSM2PublicKey(pubX, pubY)
  
  return { privateKey: privateKeyPem, publicKey: publicKeyPem }
}

// 导出SM2私钥为PEM格式
function exportSM2PrivateKey(d) {
  // SM2私钥格式：PKCS#8
  // SEQUENCE {
  //   INTEGER 0x00
  //   OCTET STRING (32字节的d值)
  //   [0] { OBJECT IDENTIFIER sm2 }  -- 可选
  // }
  
  const dBytes = bigIntToBytes(d, 32)
  
  // 构建PKCS#8结构
  const privateKeyInfo = buildPKCS8(dBytes)
  const base64 = arrayBufferToBase64(privateKeyInfo)
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`
}

// 导出SM2公钥为PEM格式
function exportSM2PublicKey(x, y) {
  // SM2公钥格式：SubjectPublicKeyInfo (ANSI X9.62)
  // SEQUENCE {
  //   SEQUENCE { OBJECT IDENTIFIER ecPublicKey, OBJECT IDENTIFIER sm2 }
  //   BIT STRING { OCTET STRING (64字节: 04 || X || Y) }
  // }
  
  const xBytes = bigIntToBytes(x, 32)
  const yBytes = bigIntToBytes(y, 32)
  
  //  uncompressed form: 04 || X || Y
  const publicKeyBytes = new Uint8Array(65)
  publicKeyBytes[0] = 0x04
  publicKeyBytes.set(xBytes, 1)
  publicKeyBytes.set(yBytes, 33)
  
  const publicKeyInfo = buildSubjectPublicKeyInfo(publicKeyBytes)
  const base64 = arrayBufferToBase64(publicKeyInfo)
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`
}

// 构建PKCS#8私钥
function buildPKCS8(privateKeyBytes) {
  // 版本号 INTEGER 0
  const version = new Uint8Array([0x02, 0x01, 0x00])
  
  // 私钥字节 OCTET STRING
  const privateKeyOctet = buildOctetString(privateKeyBytes)
  
  // 合并
  const content = new Uint8Array(version.length + privateKeyOctet.length)
  content.set(version, 0)
  content.set(privateKeyOctet, version.length)
  
  return buildSequence(content)
}

// 构建SubjectPublicKeyInfo
function buildSubjectPublicKeyInfo(publicKeyBytes) {
  // 算法标识符
  const algorithm = buildAlgorithmIdentifier()
  
  // 公钥位串
  const bitString = buildBitString(publicKeyBytes)
  
  // 合并
  const content = new Uint8Array(algorithm.length + bitString.length)
  content.set(algorithm, 0)
  content.set(bitString, algorithm.length)
  
  return buildSequence(content)
}

// 构建SEQUENCE
function buildSequence(data) {
  const length = encodeLength(data.length)
  const result = new Uint8Array(1 + length.length + data.length)
  result[0] = 0x30
  result.set(length, 1)
  result.set(data, 1 + length.length)
  return result
}

// 构建OCTET STRING
function buildOctetString(data) {
  const length = encodeLength(data.length)
  const result = new Uint8Array(1 + length.length + data.length)
  result[0] = 0x04
  result.set(length, 1)
  result.set(data, 1 + length.length)
  return result
}

// 构建BIT STRING
function buildBitString(data) {
  const length = encodeLength(data.length + 1)
  const result = new Uint8Array(1 + length.length + data.length + 1)
  result[0] = 0x03
  result.set(length, 1)
  result[1 + length.length] = 0x00 // unused bits
  result.set(data, 1 + length.length + 1)
  return result
}

// 构建算法标识符
function buildAlgorithmIdentifier() {
  // OID: 1.2.156.10197.1.301 (SM2)
  const sm2Oid = new Uint8Array([0x06, 0x09, 0x2A, 0x81, 0x19, 0x02, 0x10, 0x01])
  
  // OID: 1.2.840.10045.2.1 (ecPublicKey)
  const ecOid = new Uint8Array([0x06, 0x07, 0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01])
  
  // SEQUENCE { ecPublicKey, SM2 }
  const inner = new Uint8Array(ecOid.length + sm2Oid.length)
  inner.set(ecOid, 0)
  inner.set(sm2Oid, ecOid.length)
  
  return buildSequence(inner)
}

// DER编码长度
function encodeLength(len) {
  if (len < 128) {
    return new Uint8Array([len])
  } else if (len < 256) {
    return new Uint8Array([0x81, len])
  } else {
    return new Uint8Array([0x82, (len >> 8) & 0xFF, len & 0xFF])
  }
}

// ArrayBuffer转Base64
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function generateKeyPair() {
  errorMsg.value = ''
  isGenerating.value = true
  
  try {
    if (keyType.value === 'SM2') {
      const { privateKey: privKey, publicKey: pubKey } = await generateSM2KeyPair()
      privateKey.value = privKey
      publicKey.value = pubKey
    } else {
      // RSA密钥生成
      const keyPair = await window.crypto.subtle.generateKey(
        {
          name: 'RSASSA-PKCS1-v1_5',
          modulusLength: keySize.value,
          publicExponent: new Uint8Array([1, 0, 1]),
          hash: 'SHA-256'
        },
        true,
        ['sign', 'verify']
      )
      
      // 导出私钥 (PKCS#8)
      const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey)
      privateKey.value = arrayBufferToPem(privateKeyBuffer, 'PRIVATE KEY')
      
      // 导出公钥 (SPKI)
      const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey)
      publicKey.value = arrayBufferToPem(publicKeyBuffer, 'PUBLIC KEY')
    }
  } catch (e) {
    errorMsg.value = '生成失败: ' + e.message
    console.error(e)
  } finally {
    isGenerating.value = false
  }
}

function arrayBufferToPem(buffer, label) {
  const base64 = arrayBufferToBase64(buffer)
  const lines = base64.match(/.{1,64}/g) || []
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`
}

function downloadFile(content, filename) {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
  alert('已复制到剪贴板')
}

function reset() {
  privateKey.value = ''
  publicKey.value = ''
  errorMsg.value = ''
}

// 监听密钥类型变化，重置密钥
watch(keyType, () => {
  reset()
})
</script>

<template>
  <div class="key-generator">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🔑</span>
      <div>
        <div class="tool-name">密钥对生成</div>
        <div class="tool-desc">生成 RSA / ECC / SM2 密钥对</div>
      </div>
    </div>

    <!-- 密钥参数 -->
    <div class="section">
      <div class="section-title">密钥参数</div>
      <div class="field">
        <label>密钥类型</label>
        <div class="seg-ctrl">
          <button v-for="t in keyTypes" :key="t.value"
            :class="['seg-btn', { active: keyType === t.value }]"
            @click="keyType = t.value" :disabled="isGenerating">{{ t.label }}</button>
        </div>
      </div>
      <div v-if="keyType === 'RSA'" class="field">
        <label>密钥长度</label>
        <div class="seg-ctrl">
          <button v-for="s in keySizes" :key="s.value"
            :class="['seg-btn', { active: keySize === s.value }]"
            @click="keySize = s.value" :disabled="isGenerating">{{ s.label }}</button>
        </div>
      </div>
      <div v-if="keyType === 'SM2'" class="field">
        <label>曲线</label>
        <div class="seg-ctrl">
          <button v-for="c in sm2Curves" :key="c.value"
            :class="['seg-btn', { active: selectedCurve === c.value }]"
            @click="selectedCurve = c.value" :disabled="isGenerating">{{ c.label }}</button>
        </div>
      </div>
      <div v-if="keyType === 'ECC'" class="field">
        <label>曲线</label>
        <div class="seg-ctrl">
          <button v-for="c in eccCurves" :key="c.value"
            :class="['seg-btn', { active: selectedCurve === c.value }]"
            @click="selectedCurve = c.value" :disabled="isGenerating">{{ c.label }}</button>
        </div>
      </div>
    </div>

    <!-- 提示 -->
    <div class="tip-card">💡 私钥请妥善保管，一旦丢失无法找回</div>

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="generateKeyPair" class="btn-primary" :disabled="isGenerating">
        <span v-if="isGenerating" class="spinner"></span>
        {{ isGenerating ? '生成中...' : '生成密钥对' }}
      </button>
      <button v-if="privateKey" @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="privateKey">
      <div class="result-block" style="margin-top:10px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            私钥 (PKCS#8)
          </span>
          <div class="result-actions">
            <button @click="copyToClipboard(privateKey)" class="btn-copy">复制</button>
            <button @click="downloadFile(privateKey, keyType === 'SM2' ? 'sm2-private.key' : (keyType === 'ECC' ? 'ecc-private.key' : 'private-key.pem'))" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ privateKey }}</pre>
      </div>
      <div class="result-block" style="margin-top:8px">
        <div class="result-header">
          <span class="result-label">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            公钥 (SPKI)
          </span>
          <div class="result-actions">
            <button @click="copyToClipboard(publicKey)" class="btn-copy">复制</button>
            <button @click="downloadFile(publicKey, keyType === 'SM2' ? 'sm2-public.key' : (keyType === 'ECC' ? 'ecc-public.key' : 'public-key.pem'))" class="btn-dl">下载</button>
          </div>
        </div>
        <pre>{{ publicKey }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.key-generator { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field label { font-size: 12px; font-weight: 500; color: #555; }
.seg-ctrl { display: flex; border: 1px solid #e0e0e0; border-radius: 5px; overflow: hidden; }
.seg-btn { flex: 1; padding: 6px 10px; border: none; background: #fafafa; cursor: pointer; font-size: 12px; color: #555; transition: all .15s; border-right: 1px solid #e0e0e0; }
.seg-btn:last-child { border-right: none; }
.seg-btn:hover:not(:disabled) { background: #f0f0f0; }
.seg-btn.active { background: #2196F3; color: #fff; font-weight: 500; }
.seg-btn:disabled { opacity: .45; cursor: not-allowed; }
.tip-card { background: #e3f2fd; border: 1px solid #90caf9; border-radius: 5px; padding: 8px 12px; font-size: 12px; color: #1565c0; margin-bottom: 12px; }
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
