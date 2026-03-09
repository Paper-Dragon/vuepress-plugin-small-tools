<template>
  <div class="totp-container">
    <h3>TOTP 验证码生成器</h3>
    
    <div v-if="copyMessage" class="copy-toast">{{ copyMessage }}</div>
    
    <div class="totp-input-section">
      <div class="input-group">
        <label>账户名称：</label>
        <input v-model="newAccount.name" placeholder="例如：Google" />
      </div>
      <div class="input-group">
        <label>密钥 (Secret)：</label>
        <input v-model="newAccount.secret" placeholder="输入 TOTP 密钥" />
      </div>
      
      <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
        <span>{{ showAdvanced ? '▼' : '▶' }} 高级选项</span>
      </div>
      
      <div v-if="showAdvanced" class="advanced-section">
        <div class="input-group">
          <label>用户名（可选）：</label>
          <input v-model="newAccount.username" placeholder="例如：user@example.com" />
        </div>
        <div class="input-group">
          <label>周期（秒）：</label>
          <input v-model.number="newAccount.period" type="number" min="10" max="120" placeholder="默认 30 秒" />
        </div>
      </div>
      
      <div class="btn-row">
        <button @click="addAccount" class="btn-add">{{ editingIndex >= 0 ? '保存修改' : '添加账户' }}</button>
        <button v-if="editingIndex >= 0" @click="cancelEdit" class="btn-cancel">取消</button>
      </div>
    </div>

    <div v-if="accounts.length > 0" class="totp-list">
      <div v-for="(account, index) in accounts" :key="index" class="totp-item">
        <div class="account-info">
          <div class="account-header">
            <div class="account-title">
              <span class="account-name">{{ account.name }}</span>
              <span v-if="account.username" class="account-username">{{ account.username }}</span>
            </div>
            <div class="btn-group">
              <button @click="editAccount(index)" class="btn-edit">编辑</button>
              <button @click="removeAccount(index)" class="btn-remove">删除</button>
            </div>
          </div>
          <span class="totp-code" @click="copyCode(account.code)" title="点击复制">{{ account.code }}</span>
          <div class="secret-row">
            <span class="secret-label">密钥：</span>
            <span class="secret-value" @click="copySecret(account.secret)" title="点击复制">{{ account.secret }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: progressWidth + '%' }"></div>
          </div>
          <span class="time-left">{{ timeLeft }}s</span>
        </div>
      </div>
    </div>

    <div v-else class="empty-state">
      <p>暂无账户，请添加 TOTP 账户</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Totp',
  data() {
    return {
      accounts: [],
      newAccount: {
        name: '',
        secret: '',
        username: '',
        period: 30
      },
      timeLeft: 30,
      progressWidth: 100,
      timer: null,
      copyMessage: '',
      copyMessageTimer: null,
      editingIndex: -1,
      showAdvanced: false
    };
  },
  mounted() {
    this.loadAccounts();
    this.startTimer();
  },
  beforeDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  },
  methods: {
    loadAccounts() {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('totp-accounts');
        if (stored) {
          try {
            this.accounts = JSON.parse(stored);
            this.updateAllCodes();
          } catch (e) {
            this.accounts = [];
          }
        }
      }
    },
    saveAccounts() {
      if (typeof window !== 'undefined') {
        localStorage.setItem('totp-accounts', JSON.stringify(this.accounts));
      }
    },
    addAccount() {
      if (!this.newAccount.name || !this.newAccount.secret) {
        alert('请填写账户名称和密钥');
        return;
      }
      
      const secret = this.newAccount.secret.replace(/\s/g, '').toUpperCase();
      const period = this.newAccount.period || 30;
      
      if (this.editingIndex >= 0) {
        // 编辑模式
        this.accounts[this.editingIndex] = {
          name: this.newAccount.name,
          secret: secret,
          username: this.newAccount.username || '',
          period: period,
          code: this.generateTOTP(secret, period)
        };
        this.editingIndex = -1;
      } else {
        // 添加模式
        this.accounts.push({
          name: this.newAccount.name,
          secret: secret,
          username: this.newAccount.username || '',
          period: period,
          code: this.generateTOTP(secret, period)
        });
      }
      
      this.saveAccounts();
      this.newAccount = { name: '', secret: '', username: '', period: 30 };
      this.showAdvanced = false;
    },
    editAccount(index) {
      this.editingIndex = index;
      const account = this.accounts[index];
      this.newAccount = {
        name: account.name,
        secret: account.secret,
        username: account.username || '',
        period: account.period || 30
      };
      if (account.username || account.period !== 30) {
        this.showAdvanced = true;
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    cancelEdit() {
      this.editingIndex = -1;
      this.newAccount = { name: '', secret: '', username: '', period: 30 };
      this.showAdvanced = false;
    },
    removeAccount(index) {
      this.accounts.splice(index, 1);
      this.saveAccounts();
    },
    generateTOTP(secret, period = 30) {
      try {
        const epoch = Math.floor(Date.now() / 1000);
        const time = Math.floor(epoch / period);
        const key = this.base32Decode(secret);
        const hmac = this.hmacSha1(key, this.intToBytes(time));
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binary = ((hmac[offset] & 0x7f) << 24) |
                      ((hmac[offset + 1] & 0xff) << 16) |
                      ((hmac[offset + 2] & 0xff) << 8) |
                      (hmac[offset + 3] & 0xff);
        const otp = binary % 1000000;
        return String(otp).padStart(6, '0');
      } catch (e) {
        return '错误';
      }
    },
    base32Decode(base32) {
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let bits = '';
      for (let i = 0; i < base32.length; i++) {
        const val = alphabet.indexOf(base32[i]);
        if (val === -1) continue;
        bits += val.toString(2).padStart(5, '0');
      }
      const bytes = [];
      for (let i = 0; i + 8 <= bits.length; i += 8) {
        bytes.push(parseInt(bits.substr(i, 8), 2));
      }
      return new Uint8Array(bytes);
    },
    intToBytes(num) {
      const bytes = new Uint8Array(8);
      for (let i = 7; i >= 0; i--) {
        bytes[i] = num & 0xff;
        num = num >> 8;
      }
      return bytes;
    },
    hmacSha1(key, message) {
      const blockSize = 64;
      if (key.length > blockSize) {
        key = this.sha1(key);
      }
      const keyPadded = new Uint8Array(blockSize);
      keyPadded.set(key);
      
      const ipad = new Uint8Array(blockSize);
      const opad = new Uint8Array(blockSize);
      for (let i = 0; i < blockSize; i++) {
        ipad[i] = keyPadded[i] ^ 0x36;
        opad[i] = keyPadded[i] ^ 0x5c;
      }
      
      const innerHash = this.sha1(this.concatArrays(ipad, message));
      return this.sha1(this.concatArrays(opad, innerHash));
    },
    sha1(data) {
      const msg = new Uint8Array(data);
      const msgLen = msg.length;
      const bitLen = msgLen * 8;
      
      const paddedLen = Math.ceil((msgLen + 9) / 64) * 64;
      const padded = new Uint8Array(paddedLen);
      padded.set(msg);
      padded[msgLen] = 0x80;
      
      const view = new DataView(padded.buffer);
      view.setUint32(paddedLen - 4, bitLen, false);
      
      let h0 = 0x67452301;
      let h1 = 0xEFCDAB89;
      let h2 = 0x98BADCFE;
      let h3 = 0x10325476;
      let h4 = 0xC3D2E1F0;
      
      for (let i = 0; i < paddedLen; i += 64) {
        const w = new Uint32Array(80);
        for (let j = 0; j < 16; j++) {
          w[j] = view.getUint32(i + j * 4, false);
        }
        for (let j = 16; j < 80; j++) {
          w[j] = this.rotl(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
        }
        
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        
        for (let j = 0; j < 80; j++) {
          let f, k;
          if (j < 20) {
            f = (b & c) | ((~b) & d);
            k = 0x5A827999;
          } else if (j < 40) {
            f = b ^ c ^ d;
            k = 0x6ED9EBA1;
          } else if (j < 60) {
            f = (b & c) | (b & d) | (c & d);
            k = 0x8F1BBCDC;
          } else {
            f = b ^ c ^ d;
            k = 0xCA62C1D6;
          }
          
          const temp = (this.rotl(a, 5) + f + e + k + w[j]) >>> 0;
          e = d;
          d = c;
          c = this.rotl(b, 30);
          b = a;
          a = temp;
        }
        
        h0 = (h0 + a) >>> 0;
        h1 = (h1 + b) >>> 0;
        h2 = (h2 + c) >>> 0;
        h3 = (h3 + d) >>> 0;
        h4 = (h4 + e) >>> 0;
      }
      
      const result = new Uint8Array(20);
      const resultView = new DataView(result.buffer);
      resultView.setUint32(0, h0, false);
      resultView.setUint32(4, h1, false);
      resultView.setUint32(8, h2, false);
      resultView.setUint32(12, h3, false);
      resultView.setUint32(16, h4, false);
      
      return result;
    },
    rotl(n, b) {
      return ((n << b) | (n >>> (32 - b))) >>> 0;
    },
    concatArrays(a, b) {
      const result = new Uint8Array(a.length + b.length);
      result.set(a);
      result.set(b, a.length);
      return result;
    },
    updateAllCodes() {
      this.accounts.forEach(account => {
        account.code = this.generateTOTP(account.secret, account.period || 30);
      });
    },
    startTimer() {
      this.updateTimer();
      this.timer = setInterval(() => {
        this.updateTimer();
      }, 100);
    },
    updateTimer() {
      const epoch = Math.floor(Date.now() / 1000);
      // 使用默认 30 秒周期计算显示
      this.timeLeft = 30 - (epoch % 30);
      this.progressWidth = (this.timeLeft / 30) * 100;
      
      // 检查每个账户是否需要更新
      this.accounts.forEach(account => {
        const period = account.period || 30;
        if (epoch % period === 0) {
          account.code = this.generateTOTP(account.secret, period);
        }
      });
    },
    copySecret(secret) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(secret).then(() => {
          this.showCopyMessage('密钥已复制');
        }).catch(() => {
          this.fallbackCopy(secret, '密钥已复制');
        });
      } else {
        this.fallbackCopy(secret, '密钥已复制');
      }
    },
    copyCode(code) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          this.showCopyMessage('验证码已复制');
        }).catch(() => {
          this.fallbackCopy(code, '验证码已复制');
        });
      } else {
        this.fallbackCopy(code, '验证码已复制');
      }
    },
    fallbackCopy(text, message) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        this.showCopyMessage(message || '已复制');
      } catch (err) {
        this.showCopyMessage('复制失败');
      }
      document.body.removeChild(textarea);
    },
    showCopyMessage(message) {
      if (this.copyMessageTimer) {
        clearTimeout(this.copyMessageTimer);
      }
      this.copyMessage = message;
      this.copyMessageTimer = setTimeout(() => {
        this.copyMessage = '';
      }, 2000);
    }
  }
};
</script>


<style scoped>
.totp-container {
  max-width: 600px;
  margin: 20px auto;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  position: relative;
}

.copy-toast {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: #67c23a;
  color: white;
  padding: 10px 20px;
  border-radius: 4px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  animation: fadeInOut 2s ease-in-out;
  font-size: 13px;
}

@keyframes fadeInOut {
  0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  10% { opacity: 1; transform: translateX(-50%) translateY(0); }
  90% { opacity: 1; transform: translateX(-50%) translateY(0); }
  100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
}

h3 {
  margin: 0 0 12px 0;
  color: #333;
  font-size: 18px;
}

.totp-input-section {
  margin-bottom: 12px;
  padding: 10px;
  background: #f5f5f5;
  border-radius: 4px;
}

.input-group {
  margin-bottom: 6px;
}

.input-group:last-of-type {
  margin-bottom: 8px;
}

.input-group label {
  display: block;
  margin-bottom: 3px;
  font-weight: 500;
  color: #555;
  font-size: 12px;
}

.input-group input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 12px;
  box-sizing: border-box;
}

.btn-row {
  display: flex;
  gap: 6px;
}

.btn-add {
  flex: 1;
  padding: 6px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.btn-add:hover {
  background: #3aa876;
}

.btn-cancel {
  padding: 6px 12px;
  background: #909399;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.btn-cancel:hover {
  background: #82848a;
}

.advanced-toggle {
  margin: 8px 0 6px 0;
  padding: 4px 0;
  color: #409eff;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.advanced-toggle:hover {
  color: #66b1ff;
}

.advanced-toggle span {
  display: inline-block;
}

.advanced-section {
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px dashed #ddd;
}

.totp-list {
  margin-top: 16px;
}

.totp-item {
  padding: 12px;
  margin-bottom: 8px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  background: #fafafa;
}

.account-info {
  width: 100%;
}

.account-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.account-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-name {
  font-weight: 600;
  color: #333;
  font-size: 14px;
}

.account-username {
  font-size: 11px;
  color: #999;
}

.btn-group {
  display: flex;
  gap: 6px;
}

.btn-edit {
  padding: 4px 10px;
  background: #409eff;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.btn-edit:hover {
  background: #66b1ff;
}

.totp-code {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: #42b983;
  letter-spacing: 2px;
  margin-bottom: 6px;
  font-family: 'Courier New', monospace;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
}

.totp-code:hover {
  color: #3aa876;
}

.progress-bar {
  width: 100%;
  height: 3px;
  background: #e0e0e0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 4px;
}

.progress-fill {
  height: 100%;
  background: #42b983;
  transition: width 0.1s linear;
}

.time-left {
  font-size: 11px;
  color: #666;
}

.secret-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  padding: 4px 0;
}

.secret-label {
  font-size: 11px;
  color: #666;
  font-weight: 500;
}

.secret-value {
  font-size: 11px;
  color: #999;
  font-family: 'Courier New', monospace;
  letter-spacing: 0.5px;
  flex: 1;
  word-break: break-all;
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
}

.secret-value:hover {
  color: #666;
}

.btn-remove {
  padding: 4px 10px;
  background: #f56c6c;
  color: white;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 11px;
}

.btn-remove:hover {
  background: #e85555;
}

.empty-state {
  text-align: center;
  padding: 30px;
  color: #999;
  font-size: 13px;
}
</style>
