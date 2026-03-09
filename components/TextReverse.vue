<template>
  <div class="string-reverser-container" :class="{ 'mobile': isMobile, 'fullscreen': isFullscreen }" ref="stringReverser">
    <div class="header-section">
      <h1 class="title">文本字符串倒序</h1>
      <!-- 仅在非手机端显示网页全屏按钮 -->
      <button v-if="!isMobile" @click="toggleFullscreen" class="fullscreen-button">网页全屏</button>
    </div>
    
    <div class="input-output-section">
      <div class="input-container">
        <label class="input-label" for="inputText">输入文本：</label>
        <textarea 
          id="inputText" 
          v-model="inputText" 
          placeholder="请在此输入需要倒序的文本，例如：冬寒静烟临碧树残雪背晴楼冷天侵极戍寒月对行舟"
          class="input-box"
        ></textarea>
        <p class="hint-text">输入要倒序的文本，点击"倒序"按钮查看结果。</p>
      </div>
      
      <div class="output-container">
        <label class="output-label" for="outputText">倒序结果：</label>
        <textarea 
          id="outputText" 
          v-model="reversedText" 
          readonly 
          placeholder="倒序后的文本将显示在此处。"
          class="output-box"
        ></textarea>
        <p class="hint-text">显示输入文本的倒序结果，点击"复制"按钮可复制。</p>
      </div>
    </div>
    
    <div class="button-section">
      <button @click="reverseText" class="action-button">倒序</button>
      <button @click="clearInput" class="action-button">清除输入</button>
      <button @click="clearOutput" class="action-button">清除输出</button>
      <button @click="clearAll" class="action-button">全部清除</button>
      <button @click="copyText" class="action-button">复制</button>
      <button @click="showExample" class="action-button">示例</button>
    </div>
    
    <div class="footer-section">
      <p class="footer-text">自动把文本字符串倒序反向排列显示.</p>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: '',
      reversedText: '',
      isMobile: false,
      isFullscreen: false
    };
  },
  mounted() {
    this.checkDevice();
  },
  methods: {
    checkDevice() {
      if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
        this.isMobile = true;
      } else {
        this.isMobile = false;
      }
    },
    reverseText() {
      // 按行分割，保留换行符
      const lines = this.inputText.split('\n');
      // 对每一行进行字符倒序
      const reversedLines = lines.map(line => {
        return line.split('').reverse().join('');
      });
      // 用换行符重新连接
      this.reversedText = reversedLines.join('\n');
    },
    clearInput() {
      this.inputText = '';
    },
    clearOutput() {
      this.reversedText = '';
    },
    clearAll() {
      this.inputText = '';
      this.reversedText = '';
    },
    copyText() {
      const textarea = document.createElement('textarea');
      textarea.value = this.reversedText;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          alert('复制成功！');
        } else {
          throw new Error('复制失败');
        }
      } catch (err) {
        navigator.clipboard.writeText(this.reversedText).then(() => {
          alert('复制成功！');
        }).catch((error) => {
          alert('复制失败，请手动复制：' + this.reversedText);
        });
      } finally {
        document.body.removeChild(textarea);
      }
    },
    showExample() {
      const exampleText = `冬寒静烟临碧树残雪背晴楼冷天侵极戍寒月对行舟`;
      this.inputText = exampleText;
      this.reversedText = exampleText.split('\n').map(line => line.split('').reverse().join('')).join('\n');
    },
    toggleFullscreen() {
      const element = this.$refs.stringReverser;
      if (!this.isFullscreen) {
        element.style.position = 'fixed';
        element.style.top = '0';
        element.style.left = '0';
        element.style.width = '100vw';
        element.style.height = '100vh';
        element.style.zIndex = '9999';
        this.isFullscreen = true;
        this.adjustUIForFullscreen();
      } else {
        element.style.position = '';
        element.style.top = '';
        element.style.left = '';
        element.style.width = '';
        element.style.height = '';
        element.style.zIndex = '';
        this.isFullscreen = false;
        this.resetUI();
      }
    },
    adjustUIForFullscreen() {
      const inputBox = this.$refs.stringReverser.querySelector('.input-box');
      const outputBox = this.$refs.stringReverser.querySelector('.output-box');
      inputBox.style.height = '30vh';
      outputBox.style.height = '30vh';
    },
    resetUI() {
      const inputBox = this.$refs.stringReverser.querySelector('.input-box');
      const outputBox = this.$refs.stringReverser.querySelector('.output-box');
      inputBox.style.height = '100px';
      outputBox.style.height = '100px';
    }
  }
};
</script>

<style scoped>
.string-reverser-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 10px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  max-width: 100%;
  margin: 0 auto;
  transition: all 0.3s ease;
}

.title {
  color: #333;
}

.input-output-section {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.input-container,
.output-container {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.input-label,
.output-label {
  font-weight: bold;
}

.input-box,
.output-box {
  padding: 15px;
  border: 1px solid #ccc;
  border-radius: 5px;
  box-sizing: border-box;
  resize: vertical;
  min-height: 150px;
  transition: height 0.3s ease;
}

.button-section {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
}

.action-button {
  padding: 6px 12px;
  background-color: #007BFF;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
  font-size: 14px;
}

.action-button:hover {
  background-color: #0056b3;
}

.hint-text {
  font-size: 12px;
  color: #777;
  margin-top: 5px;
}

.footer-section {
  margin-top: 20px;
}

.footer-text {
  font-size: 14px;
  color: #777;
  text-align: center;
}

.mobile {
  font-size: 16px;
}

.mobile .input-box,
.mobile .output-box {
  min-height: 150px;
}

.mobile .action-button {
  padding: 15px 30px;
}

.fullscreen-button {
  padding: 5px 10px;
  background-color: #ccc;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.fullscreen .input-box,
.fullscreen .output-box {
  min-height: 30vh;
}
</style>
