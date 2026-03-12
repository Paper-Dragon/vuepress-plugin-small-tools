<template>
  <div class="word-tool">
    <div class="tool-header">
      <h3>字数统计</h3>
      <div class="options">
        <label><input type="checkbox" v-model="showDetail"> 详细统计</label>
      </div>
    </div>
    <div class="tool-body">
      <textarea v-model="inputText" placeholder="请输入要统计的文本..." rows="4" @input="countWords"></textarea>
      <div class="stats-grid" :class="{ compact: !showDetail }">
        <div class="stat-item">
          <span class="stat-label">字符</span>
          <span class="stat-value">{{ stats.characters }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">字符(无空格)</span>
          <span class="stat-value">{{ stats.charactersNoSpaces }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">中文</span>
          <span class="stat-value">{{ stats.chinese }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">英文</span>
          <span class="stat-value">{{ stats.english }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">数字</span>
          <span class="stat-value">{{ stats.numbers }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">行数</span>
          <span class="stat-value">{{ stats.lines }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">段落</span>
          <span class="stat-value">{{ stats.paragraphs }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">英文单词</span>
          <span class="stat-value">{{ stats.words }}</span>
        </div>
        <div class="stat-item" v-if="showDetail">
          <span class="stat-label">标点</span>
          <span class="stat-value">{{ stats.punctuation }}</span>
        </div>
        <div class="stat-item" v-if="showDetail">
          <span class="stat-label">空格</span>
          <span class="stat-value">{{ stats.spaces }}</span>
        </div>
        <div class="stat-item" v-if="showDetail">
          <span class="stat-label">特殊字符</span>
          <span class="stat-value">{{ stats.special }}</span>
        </div>
        <div class="stat-item" v-if="showDetail">
          <span class="stat-label">字节(UTF-8)</span>
          <span class="stat-value">{{ stats.bytes }}</span>
        </div>
      </div>
      <button @click="clearAll" class="btn-clear">清空</button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: '',
      showDetail: false,
      stats: {
        characters: 0,
        charactersNoSpaces: 0,
        chinese: 0,
        english: 0,
        numbers: 0,
        lines: 1,
        paragraphs: 1,
        words: 0,
        punctuation: 0,
        spaces: 0,
        special: 0,
        bytes: 0
      }
    }
  },
  methods: {
    countWords() {
      const text = this.inputText
      this.stats.characters = text.length
      this.stats.charactersNoSpaces = text.replace(/\s/g, '').length
      this.stats.chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length
      this.stats.english = (text.match(/[a-zA-Z]/g) || []).length
      this.stats.numbers = (text.match(/\d/g) || []).length
      this.stats.lines = text ? text.split('\n').length : 1
      this.stats.paragraphs = text ? text.split(/\n\s*\n/).filter(p => p.trim()).length || 1 : 1
      this.stats.words = (text.match(/[a-zA-Z]+/g) || []).length
      this.stats.punctuation = (text.match(/[^\w\s\u4e00-\u9fa5]/g) || []).length
      this.stats.spaces = (text.match(/\s/g) || []).length
      this.stats.special = (text.match(/[^\w\s\u4e00-\u9fa5]/g) || []).length - this.stats.punctuation
      this.stats.bytes = new TextEncoder().encode(text).length
    },
    clearAll() {
      this.inputText = ''
      this.countWords()
    }
  }
}
</script>

<style scoped>
.word-tool { padding: 12px; max-width: 800px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; background: #fafafa; }
.tool-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.tool-header h3 { margin: 0; font-size: 16px; }
.options { font-size: 13px; }
.options label { display: flex; align-items: center; gap: 4px; }
.tool-body { display: flex; flex-direction: column; gap: 10px; }
textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px; resize: vertical; box-sizing: border-box; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.stats-grid:not(.compact) { grid-template-columns: repeat(4, 1fr); }
.stat-item { background: #fff; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #e0e0e0; }
.stat-label { display: block; font-size: 11px; color: #666; margin-bottom: 4px; }
.stat-value { display: block; font-size: 18px; font-weight: bold; color: #2196F3; }
.btn-clear { padding: 8px 16px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; }
</style>
