# vuepress-plugin-small-tools

VuePress 插件，提供多种实用工具组件的集合。

## 功能特性

- 🔐 **TOTP验证码生成器** - 基于时间的一次性密码生成工具，支持多账户管理
- 🔄 **文本倒序工具** - 字符串反向排列，支持多行文本处理
- 🔑 **密码随机生成器** - 生成安全的随机密码，支持自定义长度和字符类型
- ⏰ **Cron表达式生成器** - 可视化生成和验证Cron表达式，预览执行时间
- 📝 **Base64编码解码** - 支持文本和图片的Base64编码解码，多种字符编码
- 🐟 **摸鱼时钟** - 上班摸鱼计时器，实时显示距离下班时间和今日收益
- 🌐 **FRP状态监控** - FRP内网穿透服务监控，实时查看代理服务状态和流量统计

## 安装

```bash
pnpm add vuepress-plugin-small-tools
```

## 使用方法

### 1. 配置插件

在 VuePress 配置文件 `.vuepress/config.js` 中添加插件：

```js
module.exports = {
  plugins: [
    ['vuepress-plugin-small-tools']
  ]
}
```

### 2. 在 Markdown 中使用

在任意 Markdown 文件中使用组件：

```markdown
# 工具集合

## TOTP验证码生成器
<Totp />

## 文本倒序工具
<TextReverse />

## 密码随机生成器
<PasswordGenerator />

## Cron表达式生成器
<Cron />

## Base64编码解码
<Base64Codec />

## 摸鱼时钟
<OxHorseClock />

## FRP状态监控
<Frp />
```

## 组件说明

### TOTP验证码生成器

- 支持添加多个账户
- 自动生成6位验证码
- 显示剩余有效时间
- 支持自定义周期和用户名
- 数据本地存储

### 文本倒序工具

- 输入文本后点击"倒序"按钮进行字符反向排列
- 支持多行文本处理，每行独立倒序
- 支持复制倒序结果
- 提供示例文本快速测试

### 密码随机生成器

- 自定义密码长度（1-100位）
- 自定义生成数量（1-50个）
- 可选择包含大写字母、小写字母、数字、特殊字符
- 点击密码即可复制
- 确保每种选中的字符类型至少出现一次

### Cron表达式生成器

- 可视化配置Cron表达式的各个字段（分钟、小时、日、月、周）
- 支持多种模式：每、范围、间隔、指定
- 实时预览生成的Cron表达式
- 显示最近5次运行时间
- 表达式有效性验证

### Base64编码解码

- 支持文本的Base64编码和解码
- 支持图片文件转Base64编码
- 支持Base64解码为图片预览
- 支持多种字符编码（UTF-8、GBK、GB2312等）
- 快捷键：Ctrl + Enter 快速编码
- 一键复制功能
- 输入输出内容交换功能

### 摸鱼时钟

- 实时倒计时显示距离下班时间
- 自动计算今日已赚金额
- 支持自定义月薪、工作日天数
- 支持自定义上下班时间
- 支持设置午休时长
- 自动识别工作状态（上班前/工作中/下班后）

### FRP状态监控

- 实时查看FRP代理服务状态
- 显示服务名称、协议类型、远程端口
- 流量统计（入站/出站）
- 当前连接数显示
- 在线/离线状态标识
- 支持自定义API地址和认证信息
- 配置信息本地保存

## 数据存储

- 所有数据仅存储在浏览器本地（localStorage）
- 不会上传到任何服务器
- 清除浏览器数据会删除所有配置信息

## 安全提示

⚠️ 请注意：
- TOTP 密钥和 FRP 认证信息是敏感信息，请妥善保管
- 建议仅在私人设备上使用
- 定期备份您的重要配置信息

## 开发

### 本地测试

```bash
# 安装依赖
pnpm install

# 进入测试站点
cd test-site

# 安装测试站点依赖
pnpm install

# 启动开发服务器
pnpm dev
```

### 项目结构

```
vuepress-plugin-small-tools/
├── components/           # 所有工具组件
│   ├── Totp.vue
│   ├── TextReverse.vue
│   ├── PasswordGenerator.vue
│   ├── Cron.vue
│   ├── Base64Codec.vue
│   ├── OxHorseClock.vue
│   └── Frp.vue
├── enhanceApp.js        # 组件注册
├── clientRootMixin.js   # 客户端混入
├── index.js             # 插件入口
├── test-site/           # 测试站点
│   ├── .vuepress/
│   │   └── config.js
│   ├── README.md        # 首页
│   └── tools.md         # 所有工具展示页
└── package.json
```

## License

MIT
