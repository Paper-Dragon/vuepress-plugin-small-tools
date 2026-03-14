<script setup>
import { ref } from 'vue'

const csrInput = ref('')
const parsed = ref(null)
const errorMsg = ref('')

function pemToBytes(pem) {
  const b64 = pem.replace(/-----(BEGIN|END)[\w\s]+-----/g, '').replace(/\s/g, '')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(':')
}

function readASN1(bytes, offset) {
  if (offset >= bytes.length) return null
  const tag = bytes[offset]
  let len = bytes[offset + 1]
  let headerLen = 2
  
  if (len >= 0x80) {
    const numBytes = len & 0x7F
    len = 0
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | bytes[offset + 2 + i]
    }
    headerLen = 2 + numBytes
  }
  
  const valueStart = offset + headerLen
  const valueEnd = valueStart + len
  
  // 边界检查
  if (valueEnd > bytes.length) {
    return null
  }
  
  const value = bytes.slice(valueStart, valueEnd)
  return { tag, len, value, headerLen, totalLen: headerLen + len }
}

function parseOID(bytes) {
  const oid = [Math.floor(bytes[0] / 40), bytes[0] % 40]
  let val = 0
  for (let i = 1; i < bytes.length; i++) {
    val = (val << 7) | (bytes[i] & 0x7F)
    if ((bytes[i] & 0x80) === 0) {
      oid.push(val)
      val = 0
    }
  }
  return oid.join('.')
}

const OID_MAP = {
  '2.5.4.3': 'CN',
  '2.5.4.6': 'C',
  '2.5.4.7': 'L',
  '2.5.4.8': 'ST',
  '2.5.4.10': 'O',
  '2.5.4.11': 'OU',
  '1.2.840.113549.1.1.1': 'RSA',
  '1.2.840.113549.1.1.5': 'SHA1withRSA',
  '1.2.840.113549.1.1.11': 'SHA256withRSA',
  '1.2.840.113549.1.1.12': 'SHA384withRSA',
  '1.2.840.113549.1.1.13': 'SHA512withRSA',
  '1.2.840.10045.2.1': 'EC',
  '1.2.840.113549.1.9.14': 'extensionRequest',
  '2.5.29.17': 'subjectAltName'
}

function parseName(bytes) {
  const result = []
  let offset = 0
  while (offset < bytes.length) {
    const item = readASN1(bytes, offset)
    if (!item) break
    if (item.tag === 0x31) { // SET
      let innerOffset = 0
      while (innerOffset < item.value.length) {
        const setItem = readASN1(item.value, innerOffset)
        if (setItem && setItem.tag === 0x30) { // SEQUENCE
          let seqOffset = 0
          while (seqOffset < setItem.value.length) {
            const attr = readASN1(setItem.value, seqOffset)
            if (attr && attr.tag === 0x06) { // OID
              const oid = parseOID(attr.value)
              const name = OID_MAP[oid] || oid
              // Next should be the value
              const nextAttr = readASN1(setItem.value, seqOffset + attr.totalLen)
              if (nextAttr && (nextAttr.tag === 0x0C || nextAttr.tag === 0x13 || nextAttr.tag === 0x1E)) {
                const val = new TextDecoder().decode(nextAttr.value)
                result.push({ name, value: val })
                break
              }
            }
            if (attr) seqOffset += attr.totalLen
            else break
          }
        }
        if (setItem) innerOffset += setItem.totalLen
        else break
      }
    }
    if (item) offset += item.totalLen
    else break
  }
  return result
}

function parse() {
  errorMsg.value = ''
  parsed.value = null
  
  if (!csrInput.value.trim()) {
    errorMsg.value = '请输入CSR PEM'
    return
  }
  
  try {
    const bytes = pemToBytes(csrInput.value)
    
    // Parse CSR structure: SEQUENCE { certificationRequestInfo, signatureAlgorithm, signature }
    const csr = readASN1(bytes, 0)
    if (!csr || csr.tag !== 0x30) {
      errorMsg.value = '无效的CSR格式：根节点不是SEQUENCE'
      return
    }
    
    // CertificationRequestInfo (first element in CSR)
    const tbsCSR = readASN1(csr.value, 0)
    
    if (!tbsCSR || tbsCSR.tag !== 0x30) {
      errorMsg.value = `无效的CSR格式：CertificationRequestInfo不是SEQUENCE (tag=0x${tbsCSR?.tag?.toString(16) || 'null'})`
      return
    }
    
    const result = { version: 0, subject: [], attributes: [], signatureAlgorithm: '', publicKey: {} }
    let offset = 0
    
    // Version (INTEGER, always 0 for PKCS#10)
    const version = readASN1(tbsCSR.value, offset)
    if (version && version.tag === 0x02) {
      result.version = version.value[0]
      offset += version.totalLen
    }
    
    // Subject (SEQUENCE of RDNSequence)
    const subject = readASN1(tbsCSR.value, offset)
    if (subject && subject.tag === 0x30) {
      result.subject = parseName(subject.value)
      offset += subject.totalLen
    } else {
      errorMsg.value = '无效的CSR格式：找不到Subject'
      return
    }
    
    // SubjectPublicKeyInfo (SEQUENCE)
    const spki = readASN1(tbsCSR.value, offset)
    if (spki && spki.tag === 0x30) {
      // Parse algorithm identifier (first element in SPKI)
      const algId = readASN1(spki.value, 0)
      if (algId && algId.tag === 0x30) {
        const algOid = readASN1(algId.value, 0)
        if (algOid && algOid.tag === 0x06) {
          const oidStr = parseOID(algOid.value)
          result.publicKey.algorithm = OID_MAP[oidStr] || oidStr
        }
      }
      // Store public key info
      result.publicKey.size = spki.len + ' bytes'
      offset += spki.totalLen
    } else {
      errorMsg.value = '无效的CSR格式：找不到SubjectPublicKeyInfo'
      return
    }
    
    // Attributes (context-specific [0], optional)
    if (offset < tbsCSR.value.length) {
      const attrs = readASN1(tbsCSR.value, offset)
      if (attrs && attrs.tag === 0xA0) {
        // Attributes is a SET of Attribute
        let attrOffset = 0
        while (attrOffset < attrs.value.length) {
          const attr = readASN1(attrs.value, attrOffset)
          if (!attr) break
          if (attr.tag === 0x30) {
            const attrOid = readASN1(attr.value, 0)
            if (attrOid && attrOid.tag === 0x06) {
              const oid = parseOID(attrOid.value)
              result.attributes.push({ oid: OID_MAP[oid] || oid, value: 'Present' })
            }
          }
          attrOffset += attr.totalLen
        }
      }
    }
    
    // Get signature algorithm from CSR (second element after CertificationRequestInfo)
    let csrOffset = tbsCSR.totalLen
    const sigAlg = readASN1(csr.value, csrOffset)
    if (sigAlg && sigAlg.tag === 0x30) {
      const algOid = readASN1(sigAlg.value, 0)
      if (algOid && algOid.tag === 0x06) {
        const oidStr = parseOID(algOid.value)
        result.signatureAlgorithm = OID_MAP[oidStr] || oidStr
      }
    }
    
    parsed.value = result
  } catch (e) {
    errorMsg.value = '解析失败: ' + e.message
  }
}

function reset() {
  csrInput.value = ''
  parsed.value = null
  errorMsg.value = ''
}
</script>

<template>
  <div class="csr-parser">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🔎</span>
      <div>
        <div class="tool-name">CSR 解析</div>
        <div class="tool-desc">解析证书签名请求的详细信息</div>
      </div>
    </div>

    <!-- 输入 CSR -->
    <div class="section">
      <div class="section-title">输入 CSR</div>
      <div class="field">
        <textarea v-model="csrInput"
          placeholder="-----BEGIN CERTIFICATE REQUEST-----&#10;...&#10;-----END CERTIFICATE REQUEST-----"
          rows="6"
          style="font-family:monospace;resize:vertical;padding:7px 10px;border:1px solid #e0e0e0;border-radius:5px;font-size:12px;box-sizing:border-box;outline:none;transition:border-color .15s;width:100%"
        ></textarea>
      </div>
    </div>

    <!-- 错误 -->
    <div v-if="errorMsg" class="error-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      {{ errorMsg }}
    </div>

    <!-- 操作按钮 -->
    <div class="action-bar">
      <button @click="parse" class="btn-primary">解析</button>
      <button @click="reset" class="btn-reset">重置</button>
    </div>

    <!-- 结果 -->
    <div v-if="parsed" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          解析结果
        </span>
      </div>
      <div style="padding:12px">
        <!-- 基本信息 -->
        <div class="sub-section-title">基本信息</div>
        <table class="info-table">
          <tbody>
            <tr><td>版本</td><td>v{{ parsed.version }}</td></tr>
            <tr><td>签名算法</td><td>{{ parsed.signatureAlgorithm }}</td></tr>
          </tbody>
        </table>

        <!-- 主题信息 -->
        <div class="sub-section-title" style="margin-top:10px">主题信息</div>
        <table class="info-table">
          <tbody>
            <tr v-for="(item, i) in parsed.subject" :key="i">
              <td>{{ item.name }}</td><td>{{ item.value }}</td>
            </tr>
          </tbody>
        </table>

        <!-- 公钥信息 -->
        <div class="sub-section-title" style="margin-top:10px">公钥信息</div>
        <table class="info-table">
          <tbody>
            <tr><td>算法</td><td>{{ parsed.publicKey.algorithm }}</td></tr>
            <tr v-if="parsed.publicKey.size"><td>大小</td><td>{{ parsed.publicKey.size }}</td></tr>
          </tbody>
        </table>

        <!-- 扩展属性 -->
        <template v-if="parsed.attributes.length">
          <div class="sub-section-title" style="margin-top:10px">扩展属性</div>
          <table class="info-table">
            <tbody>
              <tr v-for="(attr, i) in parsed.attributes" :key="i">
                <td>{{ attr.oid }}</td><td>{{ attr.value }}</td>
              </tr>
            </tbody>
          </table>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.csr-parser { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.section { margin-bottom: 14px; }
.section-title { font-size: 12px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: .05em; margin-bottom: 7px; }
.field { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
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
</style>
