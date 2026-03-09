export default {
  mounted() {
    // 初始化时从 localStorage 加载数据
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('totp-secrets');
      if (stored) {
        try {
          this.$totpSecrets = JSON.parse(stored);
        } catch (e) {
          this.$totpSecrets = [];
        }
      }
    }
  }
};
