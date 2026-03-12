<template>
  <div class="timestamp-tool">
    <div class="tool-header">
      <h3>时间戳转换</h3>
      <div class="options">
        <label>时区：
          <select v-model="timezone">
            <option value="local">本地</option>
            <option value="utc">UTC</option>
            <option value="beijing">北京</option>
          </select>
        </label>
      </div>
    </div>
    <div class="tool-body">
      <div class="conversion-row">
        <label>秒级：</label>
        <input type="number" v-model="timestampSeconds" @input="timestampToDate" />
        <span class="result">{{ dateFromTimestamp }}</span>
      </div>
      <div class="conversion-row">
        <label>毫秒：</label>
        <input type="number" v-model="timestampMs" @input="timestampMsToDate" />
        <span class="result">{{ dateFromTimestampMs }}</span>
      </div>
      <div class="conversion-row">
        <label>日期：</label>
        <input type="datetime-local" v-model="dateTime" @input="dateToTimestamp" />
        <span class="result">→ {{ timestampFromDate }} 秒</span>
      </div>
      <div class="button-group">
        <button @click="getNow" class="btn-now">现在时间</button>
        <button @click="clearAll" class="btn-clear">清空</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      timestampSeconds: Math.floor(Date.now() / 1000),
      timestampMs: Date.now(),
      dateTime: '',
      dateFromTimestamp: '',
      dateFromTimestampMs: '',
      timestampFromDate: '',
      timezone: 'local'
    }
  },
  mounted() {
    this.getNow()
  },
  methods: {
    timestampToDate() {
      try {
        const date = new Date(this.timestampSeconds * 1000)
        this.dateFromTimestamp = this.formatDate(date)
      } catch (e) {
        this.dateFromTimestamp = '无效'
      }
    },
    timestampMsToDate() {
      try {
        const date = new Date(parseInt(this.timestampMs))
        this.dateFromTimestampMs = this.formatDate(date)
      } catch (e) {
        this.dateFromTimestampMs = '无效'
      }
    },
    dateToTimestamp() {
      try {
        const date = new Date(this.dateTime)
        this.timestampFromDate = Math.floor(date.getTime() / 1000)
      } catch (e) {
        this.timestampFromDate = '无效'
      }
    },
    formatDate(date) {
      if (this.timezone === 'utc') {
        return date.toISOString().replace('T', ' ').substring(0, 19)
      } else if (this.timezone === 'beijing') {
        return date.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })
      }
      return date.toLocaleString('zh-CN')
    },
    getNow() {
      const now = new Date()
      this.timestampSeconds = Math.floor(now.getTime() / 1000)
      this.timestampMs = now.getTime()
      const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      this.dateTime = local.toISOString().slice(0, 16)
      this.timestampToDate()
      this.timestampMsToDate()
      this.dateToTimestamp()
    },
    clearAll() {
      this.timestampSeconds = 0
      this.timestampMs = 0
      this.dateTime = ''
      this.dateFromTimestamp = ''
      this.dateFromTimestampMs = ''
      this.timestampFromDate = ''
    }
  }
}
</script>

<style scoped>
.timestamp-tool { padding: 12px; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.options { font-size: 13px; }
.options select { padding: 3px 6px; border: 1px solid #ddd; border-radius: 3px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
.conversion-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.conversion-row label { min-width: 50px; font-weight: bold; font-size: 13px; }
.conversion-row input { flex: 1; min-width: 150px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; }
.result { font-size: 13px; color: #1976D2; min-width: 150px; }
.button-group { display: flex; gap: 8px; margin-top: 10px; }
button { padding: 6px 12px; border: none; border-radius: 4px; cursor: pointer; color: white; font-size: 13px; }
.btn-now { background: #4CAF50; }
.btn-clear { background: #f44336; }
</style>
