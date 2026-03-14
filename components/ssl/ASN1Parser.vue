<script setup>
import { ref } from 'vue'

const input = ref('')
const output = ref('')
const format = ref('hex')
const errorMsg = ref('')

function pemToBytes(pem) {
  const b64 = pem.replace(/-----(BEGIN|END)[\w\s]+-----/g, '').replace(/\s/g, '')
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

function readTag(tag) {
  const tags = {
    0x30: 'SEQUENCE',
    0x31: 'SET',
    0x02: 'INTEGER',
    0x03: 'BIT STRING',
    0x04: 'OCTET STRING',
    0x05: 'NULL',
    0x06: 'OID',
    0x0C: 'UTF8String',
    0x13: 'PrintableString',
    0x1E: 'BMPString',
    0x17: 'UTCTime',
    0x18: 'GeneralizedTime',
    0xA0: 'CONTEXT [0]',
    0xA1: 'CONTEXT [1]',
    0xA3: 'CONTEXT [3]'
  }
  return tags[tag] || `UNKNOWN(0x${tag.toString(16)})`
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

function parseValue(tag, bytes) {
  if (tag === 0x02) {
    // Integer - show as hex
    return '0x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  }
  if (tag === 0x06) {
    return parseOID(bytes)
  }
  if (tag === 0x05) {
    return 'NULL'
  }
  if (tag === 0x0C || tag === 0x13) {
    return new TextDecoder().decode(bytes)
  }
  if (tag === 0x17) {
    return String.fromCharCode(...bytes)
  }
  if (tag === 0x03) {
    // Bit string - skip first byte (number of unused bits)
    return '(bits): ' + Array.from(bytes.slice(1)).map(b => b.toString(16).padStart(2, '0')).join(' ')
  }
  // For other types, show hex
  return '(raw): ' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ')
}

function parseASN1(bytes, indent = 0) {
  const lines = []
  let offset = 0
  const prefix = '  '.repeat(indent)
  
  while (offset < bytes.length) {
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
    
    const value = bytes.slice(offset + headerLen, offset + headerLen + len)
    const tagName = readTag(tag)
    const valueStr = parseValue(tag, value)
    
    if (tag === 0x30 || tag === 0x31 || (tag >= 0xA0 && tag <= 0xAF)) {
      // Complex type - recurse
      lines.push(`${prefix}[${offset}] ${tagName} (len=${len})`)
      lines.push(...parseASN1(value, indent + 1))
    } else {
      lines.push(`${prefix}[${offset}] ${tagName}: ${valueStr}`)
    }
    
    offset += headerLen + len
  }
  
  return lines
}

function parse() {
  errorMsg.value = ''
  output.value = ''
  
  if (!input.value.trim()) {
    errorMsg.value = '请输入PEM或Hex内容'
    return
  }
  
  try {
    let bytes
    if (input.value.includes('BEGIN')) {
      bytes = pemToBytes(input.value)
    } else {
      // Hex input
      const hex = input.value.replace(/[^0-9a-fA-F]/g, '')
      bytes = new Uint8Array(hex.match(/.{2}/g)?.map(b => parseInt(b, 16)) || [])
    }
    
    output.value = parseASN1(bytes).join('\n')
  } catch (e) {
    errorMsg.value = '解析失败: ' + e.message
  }
}

function clear() { input.value = ''; output.value = ''; errorMsg.value = '' }
</script>

<template>
  <div class="asn1-parser">
    <!-- 标题 -->
    <div class="tool-title">
      <span class="tool-icon">🌳</span>
      <div>
        <div class="tool-name">ASN.1 解析</div>
        <div class="tool-desc">解析 PEM 或 Hex 格式的 ASN.1 结构</div>
      </div>
    </div>

    <!-- 输入 -->
    <div class="section">
      <div class="section-title">输入</div>
      <div class="field">
        <textarea v-model="input"
          placeholder="支持 PEM 格式（-----BEGIN...-----）或 Hex 字符串（3082012a...）"
          rows="5"
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
      <button @click="clear" class="btn-reset">清空</button>
    </div>

    <!-- 结果 -->
    <div v-if="output" class="result-block">
      <div class="result-header">
        <span class="result-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          ASN.1 结构
        </span>
      </div>
      <pre style="max-height:400px">{{ output }}</pre>
    </div>
  </div>
</template>

<style scoped>
.asn1-parser { padding: 16px; font-size: 13px; color: #333; }
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
pre { margin: 0; background: #1e272e; color: #a5d6a7; padding: 12px; font-size: 11px; font-family: 'SFMono-Regular', Consolas, monospace; line-height: 1.6; overflow-x: auto; white-space: pre-wrap; max-height: 200px; }
</style>
