<script setup>
import { ref } from 'vue'
import KeyGenerator from './ssl/KeyGenerator.vue'
import PEMConverter from './ssl/PEMConverter.vue'
import KeyParser from './ssl/KeyParser.vue'
import CSRGenerator from './ssl/CSRGenerator.vue'
import CSRParser from './ssl/CSRParser.vue'
import CertificateGenerator from './ssl/CertificateGenerator.vue'
import SignCSR from './ssl/SignCSR.vue'
import SignPublicKey from './ssl/SignPublicKey.vue'
import AutoSignKeypair from './ssl/AutoSignKeypair.vue'
import CertificateParser from './ssl/CertificateParser.vue'
import PFXBuilder from './ssl/PFXBuilder.vue'
import PFXParser from './ssl/PFXParser.vue'
import ASN1Parser from './ssl/ASN1Parser.vue'
import OIDLookup from './ssl/OIDLookup.vue'

const activeTab = ref('key')
const tabs = [
  { id: 'key',        label: '密钥对生成',        component: KeyGenerator },
  { id: 'convert',    label: 'PKCS1/PKCS8互转',   component: PEMConverter },
  { id: 'key-parse',  label: '私钥/公钥解析',      component: KeyParser },
  { id: 'csr',        label: 'CSR生成',            component: CSRGenerator },
  { id: 'csr-parse',  label: 'CSR解析',            component: CSRParser },
  { id: 'cert',       label: '自签名SSL证书',       component: CertificateGenerator },
  { id: 'sign-csr',   label: 'SSL证书签发(CSR)',    component: SignCSR },
  { id: 'sign-pubkey',label: 'SSL证书签发(公钥)',   component: SignPublicKey },
  { id: 'auto-sign',  label: 'SSL证书签发(自动)',   component: AutoSignKeypair },
  { id: 'cert-parse', label: 'SSL证书解析',         component: CertificateParser },
  { id: 'pfx-build',  label: 'PFX合并/生成',        component: PFXBuilder },
  { id: 'pfx-parse',  label: 'PFX解析/私钥提取',    component: PFXParser },
  { id: 'asn1',       label: 'ASN.1解析',           component: ASN1Parser },
  { id: 'oid',        label: 'OID查询',             component: OIDLookup },
]
</script>

<template>
  <div class="ssl-tools">
    <div class="tabs">
      <button 
        v-for="tab in tabs" 
        :key="tab.id"
        :class="['tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </div>
    
    <div class="tab-content">
      <component :is="tabs.find(t => t.id === activeTab).component" />
    </div>
  </div>
</template>

<style scoped>
.ssl-tools {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  background: #fafafa;
}

.tabs {
  display: flex;
  flex-wrap: wrap;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
}

.tab {
  padding: 10px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.tab:hover {
  background: #e8e8e8;
}

.tab.active {
  color: #2196F3;
  border-bottom-color: #2196F3;
  background: #fff;
}

.tab-content {
  padding: 12px;
}
</style>
