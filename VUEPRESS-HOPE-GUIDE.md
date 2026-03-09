# VuePress Theme Hope 使用指南

## 安装

```bash
pnpm add vuepress-plugin-small-tools
```

## 配置方式

### 方式1：在 config.ts 中配置（推荐）

```typescript
import { defineUserConfig } from "vuepress";
import { hopeTheme } from "vuepress-theme-hope";

export default defineUserConfig({
  // 站点配置
  base: "/",
  lang: "zh-CN",
  title: "我的站点",
  description: "站点描述",

  // 主题配置
  theme: hopeTheme({
    // 主题选项
    navbar: [
      { text: "首页", link: "/" },
      { text: "工具", link: "/tools/" }
    ],
    sidebar: "auto",
  }),

  // 插件配置
  plugins: [
    // 添加小工具插件
    ["vuepress-plugin-small-tools"]
  ],
});
```

### 方式2：使用 plugins 数组

```typescript
import { defineUserConfig } from "vuepress";
import { hopeTheme } from "vuepress-theme-hope";

export default defineUserConfig({
  base: "/",
  
  theme: hopeTheme({
    // 主题配置
  }),

  plugins: [
    "vuepress-plugin-small-tools"  // 简写形式
  ],
});
```

### 方式3：使用 import 导入

```typescript
import { defineUserConfig } from "vuepress";
import { hopeTheme } from "vuepress-theme-hope";
import smallTools from "vuepress-plugin-small-tools";

export default defineUserConfig({
  base: "/",
  
  theme: hopeTheme({
    // 主题配置
  }),

  plugins: [
    smallTools  // 直接使用导入的插件
  ],
});
```

## 在 Markdown 中使用

### 创建工具页面

创建 `docs/tools/README.md` 或 `src/tools/README.md`：

```markdown
---
title: 实用工具
icon: tool
---

# 实用工具集合

## TOTP验证码生成器

<Totp />

---

## 文本倒序工具

<TextReverse />

---

## 密码随机生成器

<PasswordGenerator />

---

## Cron表达式生成器

<Cron />

---

## Base64编码解码

<Base64Codec />

---

## 摸鱼时钟

<OxHorseClock />

---

## FRP状态监控

<Frp />
```

### 单独页面使用

创建 `docs/tools/base64.md`：

```markdown
---
title: Base64编码解码
icon: code
---

# Base64编码解码工具

支持文本和图片的Base64编码解码。

<Base64Codec />
```

## 完整配置示例

### config.ts

```typescript
import { defineUserConfig } from "vuepress";
import { hopeTheme } from "vuepress-theme-hope";

export default defineUserConfig({
  base: "/",
  lang: "zh-CN",
  title: "我的工具站",
  description: "实用工具集合",

  theme: hopeTheme({
    hostname: "https://example.com",

    author: {
      name: "Your Name",
      url: "https://example.com",
    },

    iconAssets: "fontawesome-with-brands",

    logo: "/logo.svg",

    repo: "your-username/your-repo",

    docsDir: "src",

    navbar: [
      { text: "首页", icon: "home", link: "/" },
      { 
        text: "工具", 
        icon: "tool", 
        children: [
          { text: "所有工具", link: "/tools/" },
          { text: "TOTP验证码", link: "/tools/totp" },
          { text: "Base64工具", link: "/tools/base64" },
          { text: "密码生成器", link: "/tools/password" },
        ]
      },
    ],

    sidebar: {
      "/tools/": [
        {
          text: "工具列表",
          icon: "tool",
          prefix: "/tools/",
          children: [
            { text: "所有工具", link: "" },
            { text: "TOTP验证码", link: "totp" },
            { text: "文本倒序", link: "text-reverse" },
            { text: "密码生成器", link: "password" },
            { text: "Cron生成器", link: "cron" },
            { text: "Base64工具", link: "base64" },
            { text: "摸鱼时钟", link: "clock" },
            { text: "FRP监控", link: "frp" },
          ],
        },
      ],
    },

    footer: "默认页脚",
    displayFooter: true,

    plugins: {
      // 其他插件配置
    },
  }),

  // 添加小工具插件
  plugins: [
    ["vuepress-plugin-small-tools"]
  ],
});
```

## 目录结构示例

```
your-project/
├── src/
│   ├── .vuepress/
│   │   ├── config.ts
│   │   └── public/
│   ├── README.md
│   └── tools/
│       ├── README.md          # 所有工具
│       ├── totp.md           # TOTP页面
│       ├── text-reverse.md   # 文本倒序页面
│       ├── password.md       # 密码生成器页面
│       ├── cron.md           # Cron生成器页面
│       ├── base64.md         # Base64工具页面
│       ├── clock.md          # 摸鱼时钟页面
│       └── frp.md            # FRP监控页面
├── package.json
└── pnpm-lock.yaml
```

## 常见问题

### 1. 组件未找到

**错误信息：**
```
Failed to resolve component: Base64Codec
```

**解决方法：**

```bash
# 清除缓存
rm -rf node_modules/.cache
rm -rf src/.vuepress/.cache
rm -rf src/.vuepress/.temp

# 重新安装
pnpm install

# 重启开发服务器
pnpm docs:dev
```

### 2. 样式冲突

如果组件样式与主题冲突，可以在 `.vuepress/styles/index.scss` 中调整：

```scss
// 调整工具组件样式
.totp-container,
.frp-container,
.base64-tool {
  // 自定义样式
}
```

### 3. TypeScript 类型错误

如果遇到类型错误，在 `tsconfig.json` 中添加：

```json
{
  "compilerOptions": {
    "types": ["vuepress-plugin-small-tools"]
  }
}
```

### 4. 插件不生效

确保插件配置在 `theme` 配置之外：

```typescript
export default defineUserConfig({
  theme: hopeTheme({
    // 主题配置
  }),
  
  // 插件配置要在这里，不是在 theme 里面
  plugins: [
    ["vuepress-plugin-small-tools"]
  ],
});
```

## VuePress Hope 特有功能

### 使用 Hope 的容器

```markdown
::: tip 提示
这是一个实用的工具组件
:::

<Base64Codec />

::: warning 注意
请妥善保管敏感信息
:::
```

### 使用 Hope 的标签页

```markdown
::: tabs

@tab TOTP工具

<Totp />

@tab Base64工具

<Base64Codec />

@tab 密码生成器

<PasswordGenerator />

:::
```

### 使用 Hope 的卡片

```markdown
::: card

## Base64编码解码

<Base64Codec />

:::
```

## 版本兼容性

- VuePress Theme Hope: >= 2.0.0
- VuePress: >= 2.0.0 (Hope v2) 或 >= 1.0.0 (Hope v1)
- Node.js: >= 18.0.0 (推荐)

## 示例项目

查看完整示例：
- [GitHub 仓库](https://github.com/Paper-Dragon/vuepress-plugin-small-tools)
- [在线演示](https://your-demo-site.com)

## 技术支持

遇到问题？
1. 查看 [GitHub Issues](https://github.com/Paper-Dragon/vuepress-plugin-small-tools/issues)
2. 查看 [VuePress Hope 文档](https://theme-hope.vuejs.press/)
3. 提交新的 Issue
