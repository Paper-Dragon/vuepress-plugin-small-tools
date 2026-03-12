import { defineClientConfig } from '@vuepress/client'
import Totp from './components/Totp.vue'
import TextReverse from './components/TextReverse.vue'
import PasswordGenerator from './components/PasswordGenerator.vue'
import Cron from './components/Cron.vue'
import Base64Codec from './components/Base64Codec.vue'
import OxHorseClock from './components/OxHorseClock.vue'
import Frp from './components/Frp.vue'
import QrCodeGenerator from './components/QrCodeGenerator.vue'
import JsonFormatter from './components/JsonFormatter.vue'
import TimestampConverter from './components/TimestampConverter.vue'
import ColorConverter from './components/ColorConverter.vue'
import UrlEncoder from './components/UrlEncoder.vue'
import HashGenerator from './components/HashGenerator.vue'
import UuidGenerator from './components/UuidGenerator.vue'
import JwtDecoder from './components/JwtDecoder.vue'
import WordCounter from './components/WordCounter.vue'
import LoanCalculator from './components/LoanCalculator.vue'
import BmiCalculator from './components/BmiCalculator.vue'

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
    app.component('QrCodeGenerator', QrCodeGenerator)
    app.component('JsonFormatter', JsonFormatter)
    app.component('TimestampConverter', TimestampConverter)
    app.component('ColorConverter', ColorConverter)
    app.component('UrlEncoder', UrlEncoder)
    app.component('HashGenerator', HashGenerator)
    app.component('UuidGenerator', UuidGenerator)
    app.component('JwtDecoder', JwtDecoder)
    app.component('WordCounter', WordCounter)
    app.component('LoanCalculator', LoanCalculator)
    app.component('BmiCalculator', BmiCalculator)
  },
  
  setup() {
    // 客户端设置
  },
  
  rootComponents: []
})
