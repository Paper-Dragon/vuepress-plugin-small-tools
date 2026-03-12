<template>
  <div class="uuid-tool">
    <div class="tool-header">
      <h3>🔑 UUID 工具</h3>
      <div class="options">
        <label>版本：
          <select v-model="version">
            <option value="v4">v4 随机</option>
            <option value="v1">v1 时间戳</option>
            <option value="v7">v7 时间排序</option>
          </select>
        </label>
        <label>格式：
          <select v-model="format">
            <option value="-">xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</option>
            <option value="">xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx</option>
            <option value="{}">{xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx}</option>
            <option value="url">urn:uuid:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx</option>
          </select>
        </label>
      </div>
    </div>
    <div class="tool-body">
      <div class="settings">
        <label>数量：<input type="number" v-model.number="count" min="1" max="100" /></label>
        <button @click="generateUuids" class="btn-generate">生成</button>
      </div>
    </div>
    <div v-if="uuids.length > 0" class="result-area">
      <div class="result-header">
        <span>生成 {{ uuids.length }} 个</span>
        <button @click="copyAll" class="btn-copy-all">复制全部</button>
      </div>
      <div v-for="(uuid, index) in uuids" :key="index" class="uuid-item">
        <span class="uuid-value">{{ uuid }}</span>
        <button @click="copyUuid(uuid)" class="btn-copy">复制</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      count: 5,
      uuids: [],
      version: 'v4',
      format: '-'
    }
  },
  methods: {
    generateUuids() {
      this.uuids = []
      for (let i = 0; i < this.count; i++) {
        let uuid = ''
        if (this.version === 'v4') {
          uuid = this.generateUuidV4()
        } else if (this.version === 'v1') {
          uuid = this.generateUuidV1()
        } else if (this.version === 'v7') {
          uuid = this.generateUuidV7()
        }
        if (this.format === '{}') {
          uuid = '{' + uuid + '}'
        } else if (this.format === 'url') {
          uuid = 'urn:uuid:' + uuid
        } else if (this.format === '') {
          uuid = uuid.replace(/-/g, '')
        }
        this.uuids.push(uuid)
      }
    },
    generateUuidV4() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
      })
    },
    generateUuidV1() {
      const now = Date.now()
      const timeLow = (now & 0xffffffff).toString(16).padStart(8, '0')
      const timeMid = ((now >> 32) & 0xffff).toString(16).padStart(4, '0')
      const timeHi = ((now >> 48) & 0x0fff).toString(16).padStart(4, '0')
      const clock = (Math.random() * 16383 | 0).toString(16).padStart(4, '0')
      const node = Array.from({length: 6}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
      return `${timeLow}-${timeMid}-1${clock}-${node.substring(0,4)}-${node.substring(4)}`
    },
    generateUuidV7() {
      const now = Date.now()
      const timeHex = Math.floor(now).toString(16).padStart(10, '0')
      const randomHex = Array.from({length: 16}, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('')
      return `${timeHex.substring(0,8)}-${timeHex.substring(8)}-${randomHex.substring(0,4)}-${randomHex.substring(4,8)}-${randomHex.substring(8)}`
    },
    copyUuid(uuid) {
      navigator.clipboard.writeText(uuid)
      alert('✓ 已复制')
    },
    copyAll() {
      navigator.clipboard.writeText(this.uuids.join('\n'))
      alert('✓ 已复制全部')
    }
  }
}
</script>

<style scoped>
.uuid-tool { padding: 12px; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.options { display: flex; gap: 12px; font-size: 13px; flex-wrap: wrap; }
.options label { display: flex; align-items: center; gap: 4px; }
.options select { padding: 3px 6px; border: 1px solid #ddd; border-radius: 3px; }
.tool-body { margin-bottom: 10px; }
.settings { display: flex; align-items: center; gap: 10px; }
.settings input { width: 60px; padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; }
button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; color: white; font-size: 13px; }
.btn-generate { background: #2196F3; }
.result-area { display: flex; flex-direction: column; gap: 6px; }
.result-header { display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #e3f2fd; border-radius: 4px; }
.result-header span { font-size: 13px; color: #1976D2; }
.btn-copy-all { background: #9C27B0; padding: 4px 10px; font-size: 12px; }
.uuid-item { display: flex; align-items: center; justify-content: space-between; padding: 8px; background: #fff; border-radius: 4px; border: 1px solid #ddd; }
.uuid-value { font-family: monospace; font-size: 13px; word-break: break-all; flex: 1; }
.btn-copy { background: #4CAF50; padding: 4px 8px; font-size: 12px; }
</style>
