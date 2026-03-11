import { viteBundler } from '@vuepress/bundler-vite'
import { defaultTheme } from '@vuepress/theme-default'
import { defineUserConfig } from 'vuepress'
import smallToolsPlugin from 'vuepress-plugin-small-tools'

export default defineUserConfig({
  bundler: viteBundler(),
  
  theme: defaultTheme({
    navbar: [
      { text: '首页', link: '/' },
      { text: '所有工具', link: '/tools.html' }
    ],
    sidebar: [
      '/',
      '/tools.html'
    ]
  }),
  
  title: 'VuePress 工具集合',
  description: '一站式工具集合',
  
  plugins: [
    smallToolsPlugin()
  ]
})
