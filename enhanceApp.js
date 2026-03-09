import Totp from './components/Totp.vue';
import TextReverse from './components/TextReverse.vue';
import PasswordGenerator from './components/PasswordGenerator.vue';
import Cron from './components/Cron.vue';
import Base64Codec from './components/Base64Codec.vue';
import OxHorseClock from './components/OxHorseClock.vue';
import Frp from './components/Frp.vue';

export default ({ Vue, options, router, siteData }) => {
  Vue.component('Totp', Totp);
  Vue.component('TextReverse', TextReverse);
  Vue.component('PasswordGenerator', PasswordGenerator);
  Vue.component('Cron', Cron);
  Vue.component('Base64Codec', Base64Codec);
  Vue.component('OxHorseClock', OxHorseClock);
  Vue.component('Frp', Frp);
};
