<template>
  <div class="ox-clock">
    <!-- 主显示区 -->
    <div class="clock-display">
      <div class="status-badge" :class="countdown.status">
        <span v-if="countdown.status === 'working'">🐂 上班中</span>
        <span v-else>🎉 下班了</span>
      </div>
      
      <div class="countdown-wrapper">
        <div class="countdown-label">
          {{ countdown.status === 'working' ? '距离下班' : '距离上班' }}
        </div>
        <div class="time-blocks">
          <div class="time-block">
            <div class="time-value">{{ String(countdown.hours).padStart(2, '0') }}</div>
            <div class="time-unit">时</div>
          </div>
          <div class="time-colon">:</div>
          <div class="time-block">
            <div class="time-value">{{ String(countdown.minutes).padStart(2, '0') }}</div>
            <div class="time-unit">分</div>
          </div>
          <div class="time-colon">:</div>
          <div class="time-block">
            <div class="time-value">{{ String(countdown.seconds).padStart(2, '0') }}</div>
            <div class="time-unit">秒</div>
          </div>
        </div>
      </div>
      
      <div class="earnings-card">
        <div class="earnings-icon">💰</div>
        <div class="earnings-info">
          <div class="earnings-label">今日收益</div>
          <div class="earnings-value">¥{{ todayEarnings.toFixed(2) }}</div>
        </div>
        <div class="earnings-rate">
          <div class="rate-label">时薪</div>
          <div class="rate-value">¥{{ hourlyRate }}/h</div>
        </div>
      </div>
    </div>
    
    <!-- 设置区 -->
    <div class="settings-section">
      <div class="settings-header">⚙️ 设置</div>
      <div class="settings-content">
        <div class="setting-row">
          <div class="setting-field">
            <label>💵 月薪</label>
            <input v-model.number="monthlySalary" type="number" min="0" step="100">
          </div>
          <div class="setting-field">
            <label>📅 工作日</label>
            <input v-model.number="workDays" type="number" min="1" max="31">
          </div>
        </div>
        <div class="setting-row">
          <div class="setting-field">
            <label>🌅 上班</label>
            <input v-model="startTime" type="time">
          </div>
          <div class="setting-field">
            <label>🌆 下班</label>
            <input v-model="endTime" type="time">
          </div>
          <div class="setting-field">
            <label>😴 午休</label>
            <input v-model.number="restHours" type="number" min="0" max="10" step="0.5">
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      monthlySalary: 10000,
      workDays: 22,
      timeStamp: Date.now(),
      startTime: '09:00',
      endTime: '18:00',
      restHours: 1,
      updateInterval: null
    }
  },
  computed: {
    dailyHours() {
      const parseTime = t => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }
      let total = parseTime(this.endTime) - parseTime(this.startTime)
      if (total < 0) total += 1440
      return Math.max((total - Math.min(this.restHours * 60, total)) / 60, 0)
    },
    hourlyRate() {
      return Number((this.monthlySalary / this.workDays / Math.max(this.dailyHours, 0.01)).toFixed(2))
    },
    todayEarnings() {
      const now = new Date(this.timeStamp)
      const [sh, sm] = this.startTime.split(':').map(Number)
      const [eh, em] = this.endTime.split(':').map(Number)
      const start = new Date(now).setHours(sh, sm, 0, 0)
      const end = new Date(now).setHours(eh, em, 0, 0)
      const maxSec = (end - start) / 1000 - this.restHours * 3600
      const worked = Math.min(Math.max((now - start) / 1000, 0), maxSec)
      return Number((this.hourlyRate * worked / 3600).toFixed(2))
    },
    countdown() {
      const now = new Date(this.timeStamp)
      const [sh, sm] = this.startTime.split(':').map(Number)
      const [eh, em] = this.endTime.split(':').map(Number)
      const start = new Date(now).setHours(sh, sm, 0, 0)
      const end = new Date(now).setHours(eh, em, 0, 0)
      
      let target = end
      const isOffWork = now < start || now >= end
      if (isOffWork) target = now < start ? start : new Date(start).setDate(now.getDate() + 1)
      
      const diff = target - now
      return {
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        status: now < start ? 'beforeWork' : (now >= end ? 'afterWork' : 'working')
      }
    }
  },
  watch: {
    startTime() { this.timeStamp = Date.now() },
    endTime() { this.timeStamp = Date.now() },
    restHours() { this.timeStamp = Date.now() }
  },
  mounted() {
    this.updateInterval = setInterval(() => this.timeStamp = Date.now(), 1000)
  },
  beforeDestroy() {
    clearInterval(this.updateInterval)
  }
}
</script>

<style scoped>
.ox-clock {
  max-width: 600px;
  margin: 0 auto;
  padding: 0;
}

.clock-display {
  background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%);
  border-radius: 12px;
  padding: 20px;
  color: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 12px;
  background: rgba(255, 255, 255, 0.15);
}

.status-badge.working {
  background: rgba(251, 191, 36, 0.25);
}

.status-badge.afterWork,
.status-badge.beforeWork {
  background: rgba(34, 197, 94, 0.25);
}

.countdown-wrapper {
  text-align: center;
  margin-bottom: 16px;
}

.countdown-label {
  font-size: 13px;
  opacity: 0.85;
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.time-blocks {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
}

.time-block {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 10px 14px;
  min-width: 65px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.time-value {
  font-size: 28px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  line-height: 1;
  margin-bottom: 3px;
}

.time-unit {
  font-size: 11px;
  opacity: 0.75;
}

.time-colon {
  font-size: 24px;
  font-weight: 600;
  opacity: 0.5;
}

.earnings-card {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  padding: 14px;
  border: 1px solid rgba(255, 255, 255, 0.15);
}

.earnings-icon {
  font-size: 28px;
}

.earnings-info {
  flex: 1;
}

.earnings-label {
  font-size: 11px;
  opacity: 0.75;
  margin-bottom: 3px;
}

.earnings-value {
  font-size: 22px;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.earnings-rate {
  text-align: right;
  padding-left: 10px;
  border-left: 1px solid rgba(255, 255, 255, 0.15);
}

.rate-label {
  font-size: 10px;
  opacity: 0.65;
  margin-bottom: 2px;
}

.rate-value {
  font-size: 12px;
  font-weight: 500;
}

.settings-section {
  margin-top: 12px;
  background: #f3f4f6;
  border-radius: 10px;
  overflow: hidden;
}

.settings-header {
  padding: 10px 14px;
  font-weight: 500;
  color: #374151;
  font-size: 13px;
  background: #e5e7eb;
}

.settings-content {
  padding: 14px;
  border-top: 1px solid #d1d5db;
}

.setting-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.setting-row:last-child {
  margin-bottom: 0;
}

.setting-field label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 5px;
}

.setting-field input {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  background: white;
  color: #374151;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.setting-field input:focus {
  outline: none;
  border-color: #6b7280;
}

@media (max-width: 480px) {
  .time-block {
    min-width: 55px;
    padding: 8px 10px;
  }
  
  .time-value {
    font-size: 24px;
  }
  
  .earnings-value {
    font-size: 18px;
  }
  
  .setting-row {
    grid-template-columns: 1fr;
  }
}
</style>
