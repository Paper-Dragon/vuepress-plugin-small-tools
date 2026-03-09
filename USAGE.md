# 使用指南

## 安装

### 从npm安装（推荐）

```bash
npm install vuepress-plugin-small-tools
# 或
yarn add vuepress-plugin-small-tools
# 或
pnpm add vuepress-plugin-small-tools
```

### 本地开发

```bash
# 在插件目录
pnpm link --global

# 在你的VuePress项目目录
pnpm link --global vuepress-plugin-small-tools
```

## 配置

### JavaScript配置（.vuepress/config.js）

```js
module.exports = {
  plugins: [
    ['vuepress-plugin-small-tools']
  ]
}
```

### TypeScript配置（.vuepress/config.ts）

```typescript
import { defineConfig } from 'vuepress/config'

export default defineConfig({
  plugins: [
    ['vuepress-plugin-small-tools']
  ]
})
```

## 在Markdown中使用组件

### 所有可用组件

```markdown
# TOTP验证码生成器
<Totp />

# 文本倒序工具
<TextReverse />

# 密码随机生成器
<PasswordGenerator />

# Cron表达式生成器
<Cron />

# Base64编码解码
<Base64Codec />

# 摸鱼时钟
<OxHorseClock />

# FRP状态监控
<Frp />
```

## 组件名称对照表

| 组件文件 | 注册名称 | Markdown使用 |
|---------|---------|-------------|
| Totp.vue | Totp | `<Totp />` |
| TextReverse.vue | TextReverse | `<TextReverse />` |
| PasswordGenerator.vue | PasswordGenerator | `<PasswordGenerator />` |
| Cron.vue | Cron | `<Cron />` |
| Base64Codec.vue | Base64Codec | `<Base64Codec />` |
| OxHorseClock.vue | OxHorseClock | `<OxHorseClock />` |
| Frp.vue | Frp | `<Frp />` |

## 常见问题

### 1. 组件未找到错误

如果看到类似 `Failed to resolve component: Base64Codec` 的错误：

**检查清单：**
- ✅ 确认插件已正确安装
- ✅ 确认 `.vuepress/config.js` 中已添加插件配置
- ✅ 确认组件名称拼写正确（区分大小写）
- ✅ 重启开发服务器

**解决方法：**

```bash
# 1. 清除缓存
rm -rf node_modules/.cache

# 2. 重新安装依赖
pnpm install

# 3. 重启开发服务器
pnpm dev
```

### 2. 组件不显示

如果组件标签显示但内容不显示：

- 检查浏览器控制台是否有错误
- 确认VuePress版本兼容（需要 >= 1.0.0）
- 检查是否有CSS冲突

### 3. 本地开发时组件未更新

```bash
# 重新链接插件
cd vuepress-plugin-small-tools
pnpm link --global

cd your-vuepress-project
pnpm link --global vuepress-plugin-small-tools

# 重启开发服务器
```

## 示例项目

查看 `test-site` 目录获取完整的示例项目。

```bash
cd test-site
pnpm install
pnpm dev
```

## 版本要求

- VuePress: >= 1.0.0
- Node.js: >= 12.0.0
- Vue: 2.x

## 技术支持

如果遇到问题，请：

1. 查看 [GitHub Issues](https://github.com/Paper-Dragon/vuepress-plugin-small-tools/issues)
2. 提交新的 Issue 并附上：
   - VuePress 版本
   - Node.js 版本
   - 错误信息截图
   - 配置文件内容
