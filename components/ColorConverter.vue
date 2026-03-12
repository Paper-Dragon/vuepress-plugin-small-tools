<template>
  <div class="color-tool">
    <div class="tool-header">
      <h3>🎨 颜色选择</h3>
    </div>
    <div class="tool-body">
      <!-- 颜色选择器 -->
      <div class="picker-area">
        <input type="color" v-model="pickerColor" @input="pickerToAll" class="color-picker-large" title="选择颜色" />
        <span class="picker-label">点击选择颜色</span>
      </div>
      
      <!-- 颜色格式输入框 + 复制按钮 -->
      <div class="input-row">
        <label>HEX</label>
        <input v-model="hexColor" @input="hexToOthers" placeholder="#000000" />
        <button @click="copyColor(hexColor)" class="btn-copy" title="复制">📋</button>
      </div>
      <div class="input-row">
        <label>RGB</label>
        <input v-model="rgbColor" @input="rgbToOthers" placeholder="rgb(0, 0, 0)" />
        <button @click="copyColor(rgbColor)" class="btn-copy" title="复制">📋</button>
      </div>
      <div class="input-row">
        <label>HSL</label>
        <input v-model="hslColor" @input="hslToOthers" placeholder="hsl(0, 0%, 0%)" />
        <button @click="copyColor(hslColor)" class="btn-copy" title="复制">📋</button>
      </div>
      <div class="input-row">
        <label>HSV</label>
        <input v-model="hsvColor" @input="hsvToOthers" placeholder="hsv(0, 0%, 0%)" />
        <button @click="copyColor(hsvColor)" class="btn-copy" title="复制">📋</button>
      </div>
      
      <!-- RGB滑块 -->
      <div class="sliders">
        <div class="slider-row">
          <label>R: {{ r }}</label>
          <input type="range" v-model.number="r" @input="updateFromRgb" min="0" max="255" class="slider-r" />
        </div>
        <div class="slider-row">
          <label>G: {{ g }}</label>
          <input type="range" v-model.number="g" @input="updateFromRgb" min="0" max="255" class="slider-g" />
        </div>
        <div class="slider-row">
          <label>B: {{ b }}</label>
          <input type="range" v-model.number="b" @input="updateFromRgb" min="0" max="255" class="slider-b" />
        </div>
      </div>
      
      <!-- 预设颜色 -->
      <div class="presets">
        <span class="preset-label">预设颜色：</span>
        <button v-for="color in presetColors" :key="color" 
          class="preset-btn" 
          :style="{ backgroundColor: color }"
          @click="setColor(color)"
          :title="color"></button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      hexColor: '#000000',
      rgbColor: 'rgb(0, 0, 0)',
      hslColor: 'hsl(0, 0%, 0%)',
      hsvColor: 'hsv(0, 0%, 0%)',
      r: 0, g: 0, b: 0,
      pickerColor: '#000000',
      presetColors: [
        '#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#8B00FF', '#FF00FF',
        '#FFFFFF', '#C0C0C0', '#808080', '#000000', '#800000', '#808000', '#008000', '#008080',
        '#000080', '#800080', '#FFA500', '#A52A2A', '#DEB887', '#5F9EA0', '#7FFF00', '#D2691E'
      ]
    }
  },
  methods: {
    copyColor(value) {
      navigator.clipboard.writeText(value)
    },
    pickerToAll() {
      this.hexColor = this.pickerColor
      this.hexToOthers()
    },
    setColor(color) {
      this.hexColor = color
      this.pickerColor = color
      this.hexToOthers()
    },
    hexToOthers() {
      const hex = this.hexColor.replace('#', '')
      if (hex.length === 6) {
        this.r = parseInt(hex.substr(0, 2), 16)
        this.g = parseInt(hex.substr(2, 2), 16)
        this.b = parseInt(hex.substr(4, 2), 16)
        this.updateAll()
      }
    },
    rgbToOthers() {
      const match = this.rgbColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
      if (match) {
        this.r = parseInt(match[1])
        this.g = parseInt(match[2])
        this.b = parseInt(match[3])
        this.updateAll()
      }
    },
    hslToOthers() {
      const match = this.hslColor.match(/hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/)
      if (match) {
        const h = parseInt(match[1])
        const s = parseInt(match[2]) / 100
        const l = parseInt(match[3]) / 100
        const rgb = this.hslToRgb(h, s, l)
        this.r = rgb.r; this.g = rgb.g; this.b = rgb.b
        this.updateFromRgb()
      }
    },
    hsvToOthers() {
      const match = this.hsvColor.match(/hsv\((\d+),\s*(\d+)%?,\s*(\d+)%?\)/)
      if (match) {
        const h = parseInt(match[1])
        const s = parseInt(match[2]) / 100
        const v = parseInt(match[3]) / 100
        const rgb = this.hsvToRgb(h, s, v)
        this.r = rgb.r; this.g = rgb.g; this.b = rgb.b
        this.updateFromRgb()
      }
    },
    updateFromRgb() {
      this.updateAll()
    },
    updateAll() {
      this.hexColor = '#' + [this.r, this.g, this.b].map(x => x.toString(16).padStart(2, '0')).join('')
      this.pickerColor = this.hexColor
      this.rgbColor = `rgb(${this.r}, ${this.g}, ${this.b})`
      
      const hsl = this.rgbToHsl(this.r, this.g, this.b)
      this.hslColor = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
      
      const hsv = this.rgbToHsv(this.r, this.g, this.b)
      this.hsvColor = `hsv(${hsv.h}, ${hsv.s}%, ${hsv.v}%)`
    },
    rgbToHsl(r, g, b) {
      r /= 255; g /= 255; b /= 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      let h, s, l = (max + min) / 2
      if (max === min) { h = s = 0 }
      else {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        switch (max) {
          case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
          case g: h = ((b - r) / d + 2) / 6; break
          case b: h = ((r - g) / d + 4) / 6; break
        }
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) }
    },
    hslToRgb(h, s, l) {
      h /= 360; s /= 100; l /= 100
      let r, g, b
      if (s === 0) { r = g = b = l }
      else {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1
          if (t > 1) t -= 1
          if (t < 1/6) return p + (q - p) * 6 * t
          if (t < 1/2) return q
          if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
          return p
        }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        r = hue2rgb(p, q, h + 1/3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1/3)
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
    },
    rgbToHsv(r, g, b) {
      r /= 255; g /= 255; b /= 255
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      let h, s, v = max
      const d = max - min
      s = max === 0 ? 0 : d / max
      if (max === min) { h = 0 }
      else {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break
          case g: h = (b - r) / d + 2; break
          case b: h = (r - g) / d + 4; break
        }
        h /= 6
      }
      return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) }
    },
    hsvToRgb(h, s, v) {
      h /= 360; s /= 100; v /= 100
      let r, g, b
      const i = Math.floor(h * 6)
      const f = h * 6 - i
      const p = v * (1 - s)
      const q = v * (1 - f * s)
      const t = v * (1 - (1 - f) * s)
      switch (i % 6) {
        case 0: r = v; g = t; b = p; break
        case 1: r = q; g = v; b = p; break
        case 2: r = p; g = v; b = t; break
        case 3: r = p; g = q; b = v; break
        case 4: r = t; g = p; b = v; break
        case 5: r = v; g = p; b = q; break
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
    }
  }
}
</script>

<style scoped>
.color-tool { padding: 12px; max-width: 400px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { text-align: center; margin-bottom: 10px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
.picker-area { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.color-picker-large { width: 280px; height: 120px; padding: 0; border: none; cursor: pointer; border-radius: 8px; }
.picker-label { font-size: 12px; color: #666; }
.input-row { display: flex; align-items: center; gap: 8px; }
.input-row label { min-width: 40px; font-size: 13px; font-weight: bold; }
.input-row input { flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; font-family: monospace; }
.btn-copy { padding: 4px 8px; background: #4CAF50; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
.btn-copy:hover { background: #45a049; }
.sliders { display: flex; flex-direction: column; gap: 6px; }
.slider-row { display: flex; align-items: center; gap: 8px; }
.slider-row label { min-width: 35px; font-size: 12px; }
.slider-row input[type="range"] { flex: 1; height: 8px; }
.slider-r { accent-color: #f44336; }
.slider-g { accent-color: #4CAF50; }
.slider-b { accent-color: #2196F3; }
.presets { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; }
.preset-label { width: 100%; text-align: center; font-size: 12px; }
.preset-btn { width: 24px; height: 24px; border: 1px solid #ddd; border-radius: 3px; cursor: pointer; padding: 0; }
.preset-btn:hover { transform: scale(1.2); }
</style>
