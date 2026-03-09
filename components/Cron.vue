<template>
  <div class="cron-generator">
    <h3>Cron表达式生成器</h3>
    
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.name" 
        :class="{ active: activeTab === tab.name }"
        @click="activeTab = tab.name"
      >
        {{ tab.label }}
      </button>
    </div>
    
    <div class="tab-content">
      <div v-for="tab in tabs" :key="tab.name" v-show="activeTab === tab.name">
        <h4>{{ tab.label }}设置</h4>
        
        <div class="mode-selector">
          <div class="mode-buttons">
            <button 
              v-for="mode in modes" 
              :key="mode.value" 
              :class="{ active: tab.mode === mode.value }"
              @click="tab.mode = mode.value"
            >
              {{ mode.label }}
            </button>
          </div>
        </div>
        
        <div class="options" v-if="tab.mode === 'range'">
          <div class="range-inputs">
            <label>
              从
              <input type="number" v-model="tab.from" :min="tab.min" :max="tab.max">
              到
              <input type="number" v-model="tab.to" :min="tab.min" :max="tab.max">
            </label>
          </div>
        </div>
        
        <div class="options" v-if="tab.mode === 'interval'">
          <div class="interval-inputs">
            <label>
              从
              <input type="number" v-model="tab.start" :min="tab.min" :max="tab.max">
              开始，每
              <input type="number" v-model="tab.step" min="1" :max="tab.max">
              {{ tab.label }}执行一次
            </label>
          </div>
        </div>
        
        <div class="options" v-if="tab.mode === 'specific'">
          <div class="specific-options">
            <div class="option-grid">
              <label v-for="value in tab.values" :key="value">
                <input type="checkbox" :value="value" v-model="tab.specificValues">
                {{ value }}
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="output">
      <div class="expression-fields">
        <div class="field-row">
          <div class="field-item" v-for="(tab, index) in tabs" :key="index">
            <span class="field-label">{{ tab.label }}:</span>
            <span class="field-value">{{ getFieldValue(tab.name) }}</span>
          </div>
        </div>
      </div>
      
      <h4>生成的Cron表达式：</h4>
      <input type="text" v-model="cronExpression" readonly>
      <span v-if="isValid && !cronExpression.includes('?')" class="valid">✓ 有效表达式</span>
      <span v-else-if="cronExpression.includes('?')" class="warning">⚠ 部分字段未指定</span>
      <span v-else class="invalid">✗ 无效表达式</span>
      
      <div class="next-runs" v-if="isValid">
        <h4>最近5次运行时间：</h4>
        <ul>
          <li v-for="time in nextRunTimes" :key="time">{{ time }}</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      activeTab: 'minute',
      nextRunTimes: [],
      modes: [
        { value: 'all', label: '每' },
        { value: 'range', label: '范围' },
        { value: 'interval', label: '间隔' },
        { value: 'specific', label: '指定' }
      ],
      tabs: [
        {
          name: 'minute',
          label: '分钟',
          min: 0,
          max: 59,
          mode: 'all',
          from: 0,
          to: 59,
          start: 0,
          step: 1,
          specificValues: [],
          values: Array.from({ length: 60 }, (_, i) => i)
        },
        {
          name: 'hour',
          label: '小时',
          min: 0,
          max: 23,
          mode: 'all',
          from: 0,
          to: 23,
          start: 0,
          step: 1,
          specificValues: [],
          values: Array.from({ length: 24 }, (_, i) => i)
        },
        {
          name: 'day',
          label: '日',
          min: 1,
          max: 31,
          mode: 'all',
          from: 1,
          to: 31,
          start: 1,
          step: 1,
          specificValues: [],
          values: Array.from({ length: 31 }, (_, i) => i + 1)
        },
        {
          name: 'month',
          label: '月',
          min: 1,
          max: 12,
          mode: 'all',
          from: 1,
          to: 12,
          start: 1,
          step: 1,
          specificValues: [],
          values: Array.from({ length: 12 }, (_, i) => i + 1)
        },
        {
          name: 'week',
          label: '周',
          min: 1,
          max: 7,
          mode: 'all',
          from: 1,
          to: 7,
          start: 1,
          step: 1,
          specificValues: [],
          values: Array.from({ length: 7 }, (_, i) => i + 1)
        }
      ]
    }
  },
  computed: {
    cronExpression() {
      return this.tabs.map(tab => {
        switch (tab.mode) {
          case 'range':
            return `${tab.from}-${tab.to}`
          case 'interval':
            return `${tab.start}/${tab.step}`
          case 'specific':
            return tab.specificValues.length > 0 ? tab.specificValues.join(',') : '?'
          default:
            return '*'
        }
      }).join(' ')
    },
    isValid() {
      const regex = /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])(-\d+)?(,\d+)*|\d+\/\d+) (\*|([0-9]|1[0-9]|2[0-3])(-\d+)?(,\d+)*|\d+\/\d+) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])(-\d+)?(,\d+)*|\d+\/\d+) (\*|([1-9]|1[0-2])(-\d+)?(,\d+)*|\d+\/\d+) (\*|([1-7])(-\d+)?(,\d+)*|\d+\/\d+)$/
      const isValid = regex.test(this.cronExpression)
      
      if (isValid) {
        this.calculateNextRuns()
      } else {
        this.nextRunTimes = []
      }
      
      return isValid
    }
  },
  methods: {
    calculateNextRuns() {
      const now = new Date()
      this.nextRunTimes = []
      
      const fields = this.cronExpression.split(' ')
      if (fields.length !== 5) return
      
      const [minute, hour, day, month, week] = fields
      
      const parseField = (field, min, max) => {
        if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => min + i)
        if (field.includes(',')) {
          return field.split(',').map(Number).filter(n => n >= min && n <= max)
        }
        if (field.includes('-')) {
          const [start, end] = field.split('-').map(Number)
          return Array.from({ length: end - start + 1 }, (_, i) => start + i)
        }
        if (field.includes('/')) {
          const [start, step] = field.split('/').map(Number)
          return Array.from({ length: Math.ceil((max - start + 1) / step) }, (_, i) => start + i * step)
        }
        return [Number(field)]
      }
      
      const minutes = parseField(minute, 0, 59)
      const hours = parseField(hour, 0, 23)
      const days = parseField(day, 1, 31)
      const months = parseField(month, 1, 12)
      const weeks = parseField(week, 1, 7)
      
      let count = 0
      let currentDate = new Date(now)
      
      while (count < 5) {
        if (!months.includes(currentDate.getMonth() + 1)) {
          currentDate.setMonth(currentDate.getMonth() + 1)
          currentDate.setDate(1)
          currentDate.setHours(0)
          currentDate.setMinutes(0)
          continue
        }
        
        const maxDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
        if (!days.includes(currentDate.getDate()) || currentDate.getDate() > maxDay) {
          currentDate.setDate(currentDate.getDate() + 1)
          currentDate.setHours(0)
          currentDate.setMinutes(0)
          continue
        }
        
        if (week !== '*' && !weeks.includes(currentDate.getDay() || 7)) {
          currentDate.setDate(currentDate.getDate() + 1)
          currentDate.setHours(0)
          currentDate.setMinutes(0)
          continue
        }
        
        if (!hours.includes(currentDate.getHours())) {
          currentDate.setHours(currentDate.getHours() + 1)
          currentDate.setMinutes(0)
          continue
        }
        
        if (!minutes.includes(currentDate.getMinutes())) {
          currentDate.setMinutes(currentDate.getMinutes() + 1)
          continue
        }
        
        if (currentDate.getTime() <= now.getTime()) {
          currentDate.setMinutes(currentDate.getMinutes() + 1)
          continue
        }
        
        this.nextRunTimes.push(currentDate.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }))
        count++
        currentDate.setMinutes(currentDate.getMinutes() + 1)
      }
    },
    getFieldValue(field) {
      const tab = this.tabs.find(tab => tab.name === field)
      if (!tab) return ''
      
      switch (tab.mode) {
        case 'range':
          return `${tab.from}-${tab.to}`
        case 'interval':
          return `${tab.start}/${tab.step}`
        case 'specific':
          return tab.specificValues.length > 0 ? tab.specificValues.sort((a, b) => a - b).join(',') : '?'
        default:
          return '*'
      }
    }
  }
}
</script>

<style scoped>
.cron-generator {
  width: 100%;
  max-width: 800px;
  margin: 10px auto;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
  background: white;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
  padding: 4px;
  background: #f5f5f5;
  border-radius: 4px;
}

.tabs button {
  padding: 6px 12px;
  border: none;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.tabs button:hover {
  background: #e0e0e0;
}

.tabs button.active {
  background: #007bff;
  color: white;
}

.tab-content {
  margin: 8px 0;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
}

.mode-selector {
  margin-bottom: 8px;
}

.mode-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.mode-buttons button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.mode-buttons button:hover {
  background: #f0f0f0;
}

.mode-buttons button.active {
  background: #007bff;
  color: white;
  border-color: #007bff;
}

.options {
  margin: 8px 0;
}

.range-inputs,
.interval-inputs {
  display: flex;
  gap: 6px;
  align-items: center;
  font-size: 0.85em;
}

.specific-options {
  max-height: 200px;
  overflow-y: auto;
  padding: 6px;
  background: white;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.option-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 6px;
}

.option-grid label {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 3px;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85em;
}

.option-grid label:hover {
  background: #f0f0f0;
}

.output {
  margin-top: 8px;
  padding: 8px;
  background: #fafafa;
  border-radius: 4px;
}

.expression-fields {
  margin: 2px 0;
  padding: 4px;
  background: #f5f5f5;
  border-radius: 4px;
  font-size: 0.85em;
}

.field-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.field-item {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 4px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 3px;
}

.field-label {
  font-weight: bold;
  font-size: 0.85em;
}

.field-value {
  font-size: 0.85em;
  color: #666;
}

.next-runs {
  margin: 6px 0;
  padding: 6px;
  background: #f5f5f5;
  border-radius: 3px;
}

.next-runs h4 {
  margin: 2px 0;
  font-size: 0.85em;
}

.next-runs ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.next-runs li {
  padding: 2px;
  border-bottom: 1px solid #eee;
  font-size: 0.8em;
}

.next-runs li:last-child {
  border-bottom: none;
}

.output input {
  width: 100%;
  padding: 6px;
  border: 1px solid #ddd;
  border-radius: 3px;
  margin-top: 6px;
  background: white;
  font-size: 0.85em;
}

.valid {
  color: #28a745;
  font-size: 0.85em;
}

.warning {
  color: #ffc107;
  font-size: 0.85em;
}

.invalid {
  color: #dc3545;
  font-size: 0.85em;
}
</style>
