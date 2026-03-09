<template>
  <div class="base64-tool">
    <h3>Base64 编码解码工具</h3>
    
    <!-- 字符编码选择 -->
    <div class="form-group">
      <label for="encodingSelect">字符编码:</label>
      <select id="encodingSelect" v-model="selectedEncoding">
        <option value="utf-8">UTF-8 (默认)</option>
        <option value="gbk">GBK</option>
        <option value="gb2312">GB2312</option>
        <option value="big5">Big5</option>
        <option value="shift_jis">Shift_JIS</option>
        <option value="euc-jp">EUC-JP</option>
        <option value="iso-8859-1">ISO-8859-1</option>
        <option value="windows-1252">Windows-1252</option>
      </select>
    </div>
    
    <!-- 输入框 -->
    <div class="form-group input-with-file-upload">
      <label for="inputText">输入框 (Ctrl + Enter 编码):</label>
      <div class="text-area-container">
        <textarea 
          id="inputText" 
          v-model="inputText" 
          @keydown.ctrl.enter.prevent="encodeText"
        ></textarea>
        <button @click="copyToClipboard(inputText)" class="copy-button">复制</button>
      </div>
      
      <!-- 文件上传 -->
      <div class="file-upload" v-if="imageSrc && imageArea === 'input'">
        <img :src="imageSrc" alt="预览" class="thumbnail" />
      </div>
      <div class="file-upload" v-if="!imageSrc || imageArea === 'input'">
        <label for="fileInput">选择图片文件:</label>
        <input 
          id="fileInput" 
          type="file" 
          @change="onFileChange" 
          accept="image/*"
        />
      </div>
    </div>
    
    <!-- 操作按钮 -->
    <div class="form-group">
      <button @click="encodeText" :class="{ active: inputText }">编码</button>
      <button @click="decodeText" :class="{ active: resultText }">解码</button>
      <button @click="swapContent" class="swap-button">交换</button>
      <button @click="resetFields" class="reset-button">重置</button>
    </div>
    
    <!-- 结果框 -->
    <div class="form-group">
      <label for="resultText">结果框:</label>
      <div class="text-area-container">
        <textarea id="resultText" v-model="resultText"></textarea>
        <button @click="copyToClipboard(resultText)" class="copy-button">复制</button>
      </div>
      <div class="file-upload" v-if="isImagePreview('output')">
        <img :src="resultText" alt="解码图片预览" class="thumbnail" />
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      inputText: '',
      resultText: '',
      imageSrc: '',
      selectedEncoding: 'utf-8',
      imageArea: 'input'
    };
  },
  methods: {
    async copyToClipboard(text) {
      try {
        if (navigator && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        } else {
          const textArea = document.createElement("textarea");
          textArea.value = text;
          document.body.appendChild(textArea);
          textArea.select();
          document.execCommand("copy");
          document.body.removeChild(textArea);
        }
        alert('内容已复制到剪贴板');
      } catch (err) {
        alert('复制失败：' + err);
      }
    },
    encodeText(event) {
      try {
        // 如果输入是Base64图片，直接提取Base64部分
        if (this.isBase64Image(this.inputText)) {
          const base64Match = this.inputText.match(/base64,(.+)$/);
          if (base64Match) {
            this.resultText = base64Match[1];
            return;
          }
        }
        
        // 普通文本编码
        const encoder = new TextEncoder();
        const encoded = encoder.encode(this.inputText);
        
        // 分块处理避免栈溢出
        const chunkSize = 8192;
        let result = '';
        for (let i = 0; i < encoded.length; i += chunkSize) {
          const chunk = encoded.slice(i, i + chunkSize);
          result += String.fromCharCode(...chunk);
        }
        
        this.resultText = btoa(result);
      } catch (err) {
        this.resultText = '编码失败：' + err.message;
      }
    },
    decodeText() {
      try {
        let decodedStr = '';
        try {
          decodedStr = atob(this.inputText);
        } catch (error) {
          if (error instanceof DOMException && error.name === 'InvalidCharacterError') {
            this.resultText = '解码失败：包含无效字符';
            return;
          }
          throw error;
        }
        
        const decoder = new TextDecoder(this.selectedEncoding);
        
        // 分块处理避免栈溢出
        const chunkSize = 8192;
        const bytes = new Uint8Array(decodedStr.length);
        for (let i = 0; i < decodedStr.length; i++) {
          bytes[i] = decodedStr.charCodeAt(i);
        }
        
        const decoded = decoder.decode(bytes);
        this.resultText = decoded;
        
        if (this.isBase64Image(this.resultText)) {
          this.imageSrc = this.resultText;
          this.imageArea = 'output';
        }
      } catch (err) {
        this.resultText = '解码失败：' + err.message;
      }
    },
    onFileChange(e) {
      const file = e.target.files[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onloadend = () => {
        this.imageSrc = reader.result;
        this.inputText = reader.result;
        this.imageArea = 'input';
      };
      reader.readAsDataURL(file);
    },
    swapContent() {
      [this.inputText, this.resultText] = [this.resultText, this.inputText];
      this.imageArea = this.imageArea === 'input' ? 'output' : 'input';
      if (this.imageArea === 'output') {
        document.getElementById('fileInput').value = '';
      }
    },
    resetFields() {
      this.inputText = '';
      this.resultText = '';
      this.imageSrc = '';
      this.imageArea = 'input';
      document.getElementById('fileInput').value = '';
    },
    isBase64Image(str) {
      return /^data:image\/(png|jpe?g|gif|bmp|webp);base64,/i.test(str);
    },
    isImagePreview(area) {
      return this.imageArea === area && this.isBase64Image(this.resultText);
    }
  }
};
</script>

<style scoped>
.base64-tool {
  max-width: 100%;
  margin: auto;
  padding: 20px;
  font-family: Arial, sans-serif;
}

.form-group {
  margin-bottom: 15px;
  position: relative;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
}

.text-area-container {
  position: relative;
}

textarea {
  width: 100%;
  height: 200px;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
  resize: vertical;
}

.copy-button {
  position: absolute;
  top: 5px;
  right: 5px;
  padding: 4px 8px;
  background-color: #2196F3;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  z-index: 1;
}

button {
  display: inline-block;
  padding: 8px 16px;
  margin-right: 5px;
  margin-bottom: 5px;
  background-color: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 14px;
}

button.active,
button:hover {
  background-color: #e0e0e0;
}

.swap-button {
  background-color: #4CAF50;
  color: white;
}

.reset-button {
  background-color: #FF4D4D;
  color: white;
}

.file-upload {
  margin-top: 10px;
}

.file-upload img.thumbnail {
  max-width: 100%;
  max-height: 150px;
  margin-top: 10px;
  border-radius: 4px;
}

input[type="file"] {
  display: block;
  margin-top: 5px;
}

select {
  width: 100%;
  padding: 8px;
  box-sizing: border-box;
  border: 1px solid #ccc;
  border-radius: 4px;
}
</style>
