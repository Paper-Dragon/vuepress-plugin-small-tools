import { defineClientConfig } from '@vuepress/client'
import Totp from './components/Totp.vue'
import TextReverse from './components/TextReverse.vue'
import PasswordGenerator from './components/PasswordGenerator.vue'
import Cron from './components/Cron.vue'
import Base64Codec from './components/Base64Codec.vue'
import OxHorseClock from './components/OxHorseClock.vue'
import Frp from './components/Frp.vue'

export default defineClientConfig({
  enhance({ app, router, siteData }) {
    // 注册全局组件
    app.component('Totp', Totp)
    app.component('TextReverse', TextReverse)
    app.component('PasswordGenerator', PasswordGenerator)
    app.component('Cron', Cron)
    app.component('Base64Codec', Base64Codec)
    app.component('OxHorseClock', OxHorseClock)
    app.component('Frp', Frp)
  },
  
  setup() {
    // 客户端设置
  },
  
  rootComponents: []
})
