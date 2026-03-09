<template>
  <div class="ox-clock">
    <div class="glass-panel">
      <div class="dashboard">
        <div class="time-display">
          <h2 class="status-title" :data-status="countdown.status">
            <template v-if="countdown.status === 'working'">
              摸鱼中... 距离下班还有
            </template>
            <template v-else-if="countdown.status === 'beforeWork'">
              下班啦 🎉 距离今天摸鱼还有
            </template>
            <template v-else-if="countdown.status === 'afterWork'">
              下班啦 🎉 距离明天摸鱼还有
            </template>
          </h2>
          <div class="time-row">
            <div class="time-item">
              <div class="number">{{ countdown.hours }}</div>
              <span class="label">时</span>
            </div>
            <div class="time-item">
              <div class="number">{{ countdown.minutes }}</div>
              <span class="label">分</span>
            </div>
            <div class="time-item">
              <div class="number" :data-offwork="countdown.isOffWork">{{ countdown.seconds }}</div>
              <span class="label">秒</span>
            </div>
          </div>
        </div>
        
        <div class="earning-display">
          <div class="today">
            <h3>今日已赚</h3>
            <div class="amount">¥ {{ todayEarnings.toFixed(2) }}</div>
          </div>
        </div>
      </div>
      
      <!-- 设置面板 -->
      <div class="settings-panel">
        <div class="input-row">
          <div class="input-group">
            <label>月薪（¥）</label>
            <input v-model.number="monthlySalary" type="number" min="0" step="100">
          </div>
          <div class="input-group">
            <label>工作日（天）</label>
            <input v-model.number="workDays" type="number" min="1" max="31">
          </div>
        </div>
        
        <div class="input-row">
          <div class="input-group">
            <label>上班时间</label>
            <input v-model="startTime" type="time">
          </div>
          <div class="input-group">
            <label>午休时长（小时）</label>
            <input v-model.number="restHours" type="number" min="0" max="10" step="0.5">
          </div>
          <div class="input-group">
            <label>下班时间</label>
            <input v-model="endTime" type="time">
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
      const parseMinutes = time => {
        try {
          const [h, m] = time.split(':').map(Number)
          return h * 60 + (m || 0)
        } catch {
          return 0
        }
      }
      
      const start = parseMinutes(this.startTime)
      const end = parseMinutes(this.endTime)
      let totalMinutes = end - start
      if (totalMinutes < 0) totalMinutes += 1440
      
      const rest = Math.min(Math.max(this.restHours * 60, 0), 8 * 60)
      if (rest > totalMinutes) return 0
      
      const effective = Math.max(totalMinutes - rest, 0)
      return Number((effective / 60).toFixed(2))
    },
    hourlyRate() {
      const baseHours = Math.max(this.dailyHours, 0.01)
      return Number((this.monthlySalary / this.workDays / baseHours).toFixed(2))
    },
    todayEarnings() {
      const now = new Date(this.timeStamp)
      const todayStart = new Date(now)
      const [startH, startM] = this.startTime.split(':').map(Number)
      todayStart.setHours(startH, startM, 0, 0)
      
      const todayEnd = new Date(now)
      const [endH, endM] = this.endTime.split(':').map(Number)
      todayEnd.setHours(endH, endM, 0, 0)
      
      if (todayEnd < todayStart) todayEnd.setDate(todayEnd.getDate() + 1)
      
      const restMilliseconds = this.restHours * 60 * 60 * 1000
      const maxWorkSeconds = (todayEnd - todayStart - restMilliseconds) / 1000
      
      let workSeconds = 0
      const restStart = new Date(todayStart)
      restStart.setHours(12, 0, 0, 0)
      const restEnd = new Date(restStart.getTime() + this.restHours * 60 * 60 * 1000)
      
      let adjustedNow = now
      if (now > restStart && now < restEnd) {
        adjustedNow = restEnd
      }
      
      const currentSeconds = Math.min(
        Math.max((adjustedNow - todayStart) / 1000, 0),
        maxWorkSeconds
      )
      workSeconds = currentSeconds
      
      if (now > todayEnd) {
        workSeconds = maxWorkSeconds
      }
      
      return this.hourlyRate * (workSeconds / 3600)
    },
    countdown() {
      const now = new Date(this.timeStamp)
      const todayStart = new Date(now)
      const [startH, startM] = this.startTime.split(':').map(Number)
      todayStart.setHours(startH, startM, 0, 0)
      
      const todayEnd = new Date(now)
      const [endH, endM] = this.endTime.split(':').map(Number)
      todayEnd.setHours(endH, endM, 0, 0)
      
      if (todayEnd < todayStart) todayEnd.setDate(todayEnd.getDate() + 1)
      
      let targetTime = todayEnd
      let isOffWork = now < todayStart || now >= todayEnd
      
      if (isOffWork) {
        if (now < todayStart) {
          targetTime = todayStart
        } else {
          targetTime = new Date(todayStart)
          targetTime.setDate(targetTime.getDate() + 1)
        }
      }
      
      const diff = targetTime - now
      
      return {
        hours: Math.floor(diff / 3600000),
        minutes: Math.floor((diff % 3600000) / 60000),
        seconds: Math.floor((diff % 60000) / 1000),
        isOffWork,
        status: now < todayStart ? 'beforeWork' : (now >= todayEnd ? 'afterWork' : 'working')
      }
    }
  },
  watch: {
    startTime() {
      this.timeStamp = Date.now()
    },
    endTime() {
      this.timeStamp = Date.now()
    },
    restHours() {
      this.timeStamp = Date.now()
    }
  },
  mounted() {
    this.updateInterval = setInterval(() => {
      this.timeStamp = Date.now()
    }, 1000)
  },
  beforeDestroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
    }
  }
}
</script>

<style scoped>
:root {
  --primary-color: #6C7A89;
  --secondary-color: #8D9CAF;
  --text-shadow: 0 0 15px rgba(108, 122, 137, 0.3);
  --bg-gradient: linear-gradient(135deg, rgba(140, 160, 180, 0.15) 0%, rgba(100, 120, 140, 0.1) 100%);
  --panel-bg: rgba(0, 0, 0, 0.3);
}

.ox-clock {
  position: relative;
  max-width: 800px;
  margin: 2rem auto;
  padding: 2rem;
  border-radius: 20px;
  background: linear-gradient(135deg, rgba(210, 225, 240, 0.3) 0%, rgba(190, 210, 230, 0.25) 100%);
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.status-title {
  text-align: center;
  color: #4A5568;
  margin-bottom: 1.5rem;
  font-size: 1.8em;
  transition: all 0.3s ease;
}

.status-title[data-offwork="true"] {
  color: #4CAF50;
  transform: scale(1.1);
  animation: celebrate 2s ease-in-out infinite;
}

.time-item[data-offwork="true"] .number {
  opacity: 0.3;
  filter: blur(2px);
}

.glass-panel {
  padding: 2rem;
  background: rgba(225, 235, 245, 0.2);
  border-radius: 15px;
  margin-bottom: 1.5rem;
  backdrop-filter: blur(20px);
}

.dashboard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
}

.time-display {
  display: grid;
  gap: 1rem;
  margin-bottom: 2rem;
}

.time-row {
  display: flex;
  justify-content: center;
  gap: 1.2rem;
}

.time-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.2rem;
  background: linear-gradient(145deg, rgba(140, 160, 185, 0.3) 0%, rgba(190, 210, 230, 0.25) 100%);
  border-radius: 15px;
}

.number {
  font-size: 3.5em;
  min-width: 1.6em;
  display: inline-block;
  text-align: center;
  font-family: 'Courier New', monospace;
  font-variant-numeric: tabular-nums;
  color: #2D3748;
  text-shadow: var(--text-shadow);
  line-height: 1;
  transition: opacity 0.3s;
  margin: 0 auto;
}

.label {
  font-size: 1.2em;
  color: #4A5568;
  margin-top: 0.5rem;
  opacity: 0.9;
}

.earning-display {
  text-align: center;
}

.amount {
  font-size: 2.2em;
  color: #2D3748;
  margin: 1rem 0;
  text-shadow: var(--text-shadow);
  font-family: 'Courier New';
}

@keyframes celebrate {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.8;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.settings-panel {
  padding: 1.5rem;
  background: var(--panel-bg);
  border-radius: 15px;
}

.input-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}

.input-group {
  margin-bottom: 0;
}

.input-group label {
  display: block;
  color: #4A5568;
  margin-bottom: 0.5rem;
  font-size: 0.9em;
  opacity: 0.8;
}

input {
  width: 70%;
  max-width: 300px;
  padding: 0.8rem 1.2rem;
  background: rgba(108, 122, 137, 0.15);
  border: 1px solid var(--primary-color);
  border-radius: 12px;
  color: var(--primary-color);
  font-family: inherit;
  font-size: 1.1em;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(4px);
}

input::placeholder {
  color: rgba(108, 122, 137, 0.6);
  font-weight: 300;
}

input:focus {
  outline: 2px solid transparent;
  border-color: var(--secondary-color);
  box-shadow: 0 0 20px rgba(140, 160, 180, 0.25);
  background: rgba(108, 122, 137, 0.25);
}

input[type="time"]::-webkit-calendar-picker-indicator {
  filter: invert(0.6);
}
</style>
