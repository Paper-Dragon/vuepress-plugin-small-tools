<script setup>
import { ref } from 'vue'

const keyInput = ref('')
const keyType = ref('private') // 'private' or 'public'
const parsedKey = ref(null)
const errorMsg = ref('')

// PEM标签到类型的映射
const KEY_TYPES = {
  'RSA PRIVATE KEY': 'RSA (PKCS#1)',
  'EC PRIVATE KEY': 'EC (PKCS#8)',
  'PRIVATE KEY': 'PKCS#8 (通用)',
  'PUBLIC KEY': '公钥 (SPKI)'
}

// ASN.1 tag definitions
const ASN1 = {
  SEQUENCE: 0x30,
  INTEGER: 0x02,
  OCTET_STRING: 0x04,
  BIT_STRING: 0x03,
  OBJECT_IDENTIFIER: 0x06,
  UTF8_STRING: 0x0C,
  PRINTABLE_STRING: 0x13,
  IA5_STRING: 0x1A,
  UTCTIME: 0x17,
  GENERALIZEDTIME: 0x18
}

// OID映射表
const OID_MAP = {
  '1.2.840.113549.1.1.1': 'rsaEncryption',
  '1.2.840.113549.1.1.5': 'sha1WithRSAEncryption',
  '1.2.840.113549.1.1.11': 'sha256WithRSAEncryption',
  '1.2.840.113549.1.1.12': 'sha384WithRSAEncryption',
  '1.2.840.113549.1.1.13': 'sha512WithRSAEncryption',
  '1.2.840.10045.2.1': 'ecPublicKey',
  '1.2.840.10045.4.3.2': 'ecdsa-with-SHA256',
  '1.2.840.10045.4.3.3': 'ecdsa-with-SHA384',
  '1.2.840.10045.4.3.4': 'ecdsa-with-SHA512',
  '1.2.156.10197.1.301': 'sm2',
  '1.2.156.10197.1.401': 'sm3',
  '1.2.156.10197.1.302': 'sm4-ECB',
  '1.2.156.10197.1.104.1': 'sm4',
  '2.5.4.3': 'commonName',
  '2.5.4.6': 'countryName',
  '2.5.4.7': 'localityName',
  '2.5.4.8': 'stateOrProvinceName',
  '2.5.4.10': 'organizationName',
  '2.5.4.11': 'organizationalUnitName'
}

function pemToArrayBuffer(pem) {
  const base64 = pem.replace(/-----(BEGIN|END)[\w\s]+-----/g, '').replace(/\s/g, '')
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function readTag(buffer, offset) {
  if (offset >= buffer.byteLength) return null
  
  const bytes = new Uint8Array(buffer)
  const tag = bytes[offset]
  let len = bytes[offset + 1]
  
  if (len & 0x80) {
    const numBytes = len & 0x7f
    len = 0
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | bytes[offset + 2 + i]
    }
    return { tag, length: len, headerLength: 2 + numBytes }
  }
  
  return { tag, length: len, headerLength: 2 }
}

function readInteger(buffer, offset, length) {
  const bytes = new Uint8Array(buffer, offset, length)
  let result = 0n
  for (let i = 0; i < length; i++) {
    result = (result << 8n) | BigInt(bytes[i])
  }
  return result
}

function readOID(buffer, offset, length) {
  const bytes = new Uint8Array(buffer, offset, length)
  const oid = []
  
  oid.push(bytes[0] % 40)
  oid.push(Math.floor(bytes[0] / 40))
  
  let value = 0n
  for (let i = 1; i < bytes.length; i++) {
    value = (value << 7n) | BigInt(bytes[i] & 0x7f)
    if (!(bytes[i] & 0x80)) {
      oid.push(Number(value))
      value = 0n
    }
  }
  
  return oid.join('.')
}

function readString(buffer, offset, length, tag) {
  const bytes = new Uint8Array(buffer, offset, length)
  let str = ''
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i])
  }
  return str
}

function parseASN1(buffer, offset = 0, depth = 0) {
  if (offset >= buffer.byteLength) return null
  
  const tagInfo = readTag(buffer, offset)
  if (!tagInfo) return null
  
  const valueOffset = offset + tagInfo.headerLength
  const result = {
    tag: tagInfo.tag,
    tagName: getTagName(tagInfo.tag),
    length: tagInfo.length,
    offset: offset,
    children: []
  }
  
  if (tagInfo.tag === ASN1.SEQUENCE || tagInfo.tag === ASN1.SET) {
    let childOffset = valueOffset
    while (childOffset < valueOffset + tagInfo.length) {
      const child = parseASN1(buffer, childOffset, depth + 1)
      if (!child) break
      result.children.push(child)
      childOffset = child.offset + child.totalLength
    }
  } else if (tagInfo.tag === ASN1.INTEGER) {
    const intValue = readInteger(buffer, valueOffset, tagInfo.length)
    result.value = '0x' + intValue.toString(16)
  } else if (tagInfo.tag === ASN1.OCTET_STRING || tagInfo.tag === ASN1.BIT_STRING) {
    // 如果内容是SEQUENCE，递归解析
    if (tagInfo.tag === ASN1.BIT_STRING && tagInfo.length > 0) {
      const bytes = new Uint8Array(buffer, valueOffset, tagInfo.length)
      if (bytes[0] === 0x00 && tagInfo.length > 1) {
        // 跳过未使用的位
        const innerBuffer = buffer.slice(valueOffset + 1, valueOffset + tagInfo.length)
        const innerTag = readTag(innerBuffer, 0)
        if (innerTag && innerTag.tag === ASN1.SEQUENCE) {
          result.innerSequence = parseASN1(innerBuffer, 0, depth + 1)
        }
      }
    }
    result.value = `[${tagInfo.length} bytes]`
  } else if (tagInfo.tag === ASN1.OBJECT_IDENTIFIER) {
    const oid = readOID(buffer, valueOffset, tagInfo.length)
    result.value = oid
    result.oidName = OID_MAP[oid] || oid
  } else if (tagInfo.tag === ASN1.UTF8_STRING || tagInfo.tag === ASN1.PRINTABLE_STRING || 
             tagInfo.tag === ASN1.IA5_STRING) {
    result.value = readString(buffer, valueOffset, tagInfo.length, tagInfo.tag)
  } else if (tagInfo.tag === ASN1.UTCTIME) {
    result.value = readString(buffer, valueOffset, tagInfo.length, tagInfo.tag)
  } else if (tagInfo.tag === ASN1.GENERALIZEDTIME) {
    result.value = readString(buffer, valueOffset, tagInfo.length, tagInfo.tag)
  }
  
  result.totalLength = tagInfo.headerLength + tagInfo.length
  return result
}

function getTagName(tag) {
  for (const [name, value] of Object.entries(ASN1)) {
    if (value === tag) return name
  }
  return '0x' + tag.toString(16).toUpperCase()
}

function parsePrivateKey(pem) {
  errorMsg.value = ''
  parsedKey.value = null
  
  try {
    // 检测密钥类型
    let keyType = null
    let keyData = null
    
    if (pem.includes('-----BEGIN RSA PRIVATE KEY-----')) {
      keyType = 'RSA (PKCS#1)'
      keyData = pemToArrayBuffer(pem)
    } else if (pem.includes('-----BEGIN EC PRIVATE KEY-----')) {
      keyType = 'EC (PKCS#8 - EC)'
      keyData = pemToArrayBuffer(pem)
    } else if (pem.includes('-----BEGIN PRIVATE KEY-----')) {
      keyType = 'PKCS#8 (通用)'
      keyData = pemToArrayBuffer(pem)
    } else if (pem.includes('-----BEGIN PUBLIC KEY-----')) {
      keyType = '公钥 (SPKI)'
      keyData = pemToArrayBuffer(pem)
    } else {
      // 尝试作为DER格式解析
      const der = pem.replace(/[^A-Za-z0-9+/=]/g, '')
      try {
        keyData = pemToArrayBuffer('-----BEGIN-----\n' + der + '\n-----END-----')
        keyType = 'DER格式'
      } catch {
        throw new Error('无法识别的密钥格式')
      }
    }
    
    const asn1 = parseASN1(keyData)
    
    parsedKey.value = {
      type: keyType,
      format: keyData.byteLength > 500 ? 'DER (二进制)' : 'PEM',
      size: keyData.byteLength + ' bytes',
      asn1: asn1,
      details: extractKeyDetails(asn1, keyType)
    }
  } catch (e) {
    errorMsg.value = '解析失败: ' + e.message
  }
}

function extractKeyDetails(asn1, keyType) {
  const details = {}
  
  if (!asn1 || !asn1.children) return details
  
  // 查找版本号
  const versionChild = asn1.children.find(c => c.tag === ASN1.INTEGER && c.value)
  if (versionChild) {
    details.version = versionChild.value
  }
  
  // 查找公钥算法OID
  const findOID = (node, target) => {
    if (!node) return null
    if (node.tag === ASN1.OBJECT_IDENTIFIER && node.value === target) return node
    if (node.children) {
      for (const child of node.children) {
        const found = findOID(child, target)
        if (found) return found
      }
    }
    return null
  }
  
  // 查找算法标识符
  const algoSeq = asn1.children.find(c => c.tag === ASN1.SEQUENCE && c.children && c.children.some(ch => ch.tag === ASN1.OBJECT_IDENTIFIER))
  if (algoSeq && algoSeq.children) {
    const oidChild = algoSeq.children.find(c => c.tag === ASN1.OBJECT_IDENTIFIER)
    if (oidChild) {
      details.algorithm = oidChild.oidName || oidChild.value
    }
  }
  
  // RSA密钥: 查找模数和指数
  if (keyType.includes('RSA')) {
    // 查找公钥指数
    const pubKeySeq = asn1.children.find(c => c.tag === ASN1.SEQUENCE && c.children && c.children.length >= 9)
    if (pubKeySeq && pubKeySeq.children) {
      // 通常是 [0] n, [1] e
      const pubKeyBitString = pubKeySeq.children.find(c => c.tag === ASN1.BIT_STRING)
      if (pubKeyBitString && pubKeyBitString.innerSequence) {
        const pubKeyParts = pubKeyBitString.innerSequence.children
        if (pubKeyParts && pubKeyParts.length >= 2) {
          details.publicExponent = pubKeyParts[1].value
        }
      }
    }
    
    // 从完整的RSA私钥结构中提取更多信息
    if (asn1.children.length >= 9) {
      // RSA私钥: version, n, e, d, p, q, dmp1, dmq1, iqmp
      const n = asn1.children.find((c, i) => i === 1 && c.tag === ASN1.INTEGER)
      const e = asn1.children.find((c, i) => i === 2 && c.tag === ASN1.INTEGER)
      if (n) details.modulus = n.value
      if (e) details.publicExponent = e.value
    }
  }
  
  // EC密钥: 查找曲线OID
  if (keyType.includes('EC') || keyType.includes('PKCS#8')) {
    // 查找曲线参数
    const curveSeq = asn1.children.find(c => c.tag === ASN1.SEQUENCE && c.children && c.children.length >= 3)
    if (curveSeq && curveSeq.children) {
      const curveOid = curveSeq.children.find(c => c.tag === ASN1.OBJECT_IDENTIFIER && c.value)
      if (curveOid) {
        details.curve = curveOid.oidName || curveOid.value
      }
    }
    
    // 如果没有找到曲线，可能在public key部分
    if (!details.curve) {
      for (const child of asn1.children) {
        if (child.innerSequence) {
          const innerAlgo = child.innerSequence.children.find(c => c.tag === ASN1.SEQUENCE)
          if (innerAlgo && innerAlgo.children) {
            const curveOid = innerAlgo.children.find(c => c.tag === ASN1.OBJECT_IDENTIFIER)
            if (curveOid) {
              details.curve = curveOid.oidName || curveOid.value
              break
            }
          }
        }
      }
    }
  }
  
  return details
}

function parseKey() {
  if (!keyInput.value.trim()) {
    errorMsg.value = '请输入密钥内容'
    return
  }
  
  // 增强的输入验证
  const input = keyInput.value.trim()
  const hasPrivateKey = input.includes('BEGIN PRIVATE KEY') || 
                        input.includes('BEGIN RSA PRIVATE KEY') || 
                        input.includes('BEGIN EC PRIVATE KEY')
  const hasPublicKey = input.includes('BEGIN PUBLIC KEY') || 
                       input.includes('BEGIN RSA PUBLIC KEY')
  
  if (!hasPrivateKey && !hasPublicKey) {
    errorMsg.value = '无效的密钥格式：缺少 BEGIN 标记。请确保输入的是 PEM 格式的密钥。'
    return
  }
  
  const hasEndMarker = input.includes('END PRIVATE KEY') || 
                       input.includes('END RSA PRIVATE KEY') || 
                       input.includes('END EC PRIVATE KEY') ||
                       input.includes('END PUBLIC KEY') ||
                       input.includes('END RSA PUBLIC KEY')
  
  if (!hasEndMarker) {
    errorMsg.value = '无效的密钥格式：缺少 END 标记。请确保密钥内容完整。'
    return
  }
  
  parsePrivateKey(input)
}

function reset() {
  keyInput.value = ''
  parsedKey.value = null
  errorMsg.value = ''
}

function formatKeyDetails(details) {
  if (!details) return []
  
  const lines = []
  if (details.version) lines.push(['版本', details.version])
  if (details.algorithm) lines.push(['算法', details.algorithm])
  if (details.curve) lines.push(['曲线', details.curve])
  if (details.modulus) lines.push(['模数 (n)', details.modulus.substring(0, 40) + '...'])
  if (details.publicExponent) lines.push(['公钥指数 (e)', details.publicExponent])
  
  return lines
}
</script>

<template>
  <div class="key-parser">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🔍</span>
      <div>
        <div class="tool-name">私钥 / 公钥解析</div>
        <div class="tool-desc">解析 PEM 格式的私钥或公钥</div>
      </div>
    </div>

    <!-- 输入密钥 -->
    <div class="section">
      <div class="section-title">输入密钥</div>
      <div class="field">
        <textarea v-model="keyInput"
          placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQIBADANBgkqhkiG9w0BAQEFAASCB...&#10;-----END PRIVATE KEY-----&#10;&#10;或&#10;&#10;-----BEGIN PUBLIC KEY-----&#10;MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A...&#10;-----END PUBLIC KEY-----"
          rows="8"
          style="font-family:monospace;resize:vertical;padding:7px 10px;border:1px solid #e0e0e0;border-radius:5px;font-size:12px;box-sizing:border-box;outline:none;transition:border-color .15s;width:100%"
        ></textarea>
        <span class="field-hint">支持：PRIVATE KEY · RSA PRIVATE KEY · EC PRIVATE KEY · PUBLIC KEY</span>
      </div>
    </div>

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="parseKey" class="btn-primary">解析</button>
      <button @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="parsedKey" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          解析结果
        </span>
      </div>
      <div style="padding:12px">
        <!-- 密钥信息 -->
        <div class="sub-section-title">密钥信息</div>
        <table class="info-table">
          <tbody>
            <tr><td>类型</td><td>{{ parsedKey.type }}</td></tr>
            <tr><td>格式</td><td>{{ parsedKey.format }}</td></tr>
            <tr><td>大小</td><td>{{ parsedKey.size }}</td></tr>
          </tbody>
        </table>

        <!-- 密钥参数 -->
        <template v-if="parsedKey.details && formatKeyDetails(parsedKey.details).length > 0">
          <div class="sub-section-title" style="margin-top:10px">密钥参数</div>
          <table class="info-table">
            <tbody>
              <tr v-for="[label, value] in formatKeyDetails(parsedKey.details)" :key="label">
                <td>{{ label }}</td><td>{{ value }}</td>
              </tr>
            </tbody>
          </table>
        </template>

        <!-- ASN.1 结构 -->
        <div class="sub-section-title" style="margin-top:10px">ASN.1 结构</div>
        <pre style="max-height:150px">{{ JSON.stringify(parsedKey.asn1, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.key-parser { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
.field-hint { font-size: 11px; color: #aaa; }
.error-bar { display: flex; align-items: center; gap: 6px; background: #fdecea; color: #c62828; padding: 8px 12px; border-radius: 5px; font-size: 12px; margin-bottom: 10px; border: 1px solid #f5c6cb; }
.action-bar { display: flex; gap: 8px; margin-top: 14px; }
.btn-primary { flex: 1; padding: 10px 20px; background: #2196F3; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background .15s; box-shadow: 0 1px 3px rgba(33,150,243,.3); }
.btn-primary:hover { background: #1976D2; }
.btn-reset { padding: 10px 18px; background: #fff; color: #666; border: 1px solid #ddd; border-radius: 6px; cursor: pointer; font-size: 13px; }
.btn-reset:hover { background: #f5f5f5; }
.result-block { margin-top: 14px; border: 1px solid #c8e6c9; border-radius: 6px; overflow: hidden; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #f1f8e9; border-bottom: 1px solid #c8e6c9; }
.result-label { display: flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 500; color: #2e7d32; }
.sub-section-title { font-size: 11px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 5px; }
.info-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.info-table tr:nth-child(even) td { background: #f9f9f9; }
.info-table td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
.info-table td:first-child { font-weight: 500; color: #555; width: 120px; white-space: nowrap; }
.info-table td:last-child { font-family: monospace; word-break: break-all; color: #333; }
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 200px; }
</style>
