<script setup>
import { ref, computed } from 'vue'

const query = ref('')

// 常用 OID 数据库
const OID_DB = [
  // RSA
  { oid: '1.2.840.113549.1.1.1',  name: 'rsaEncryption',            desc: 'RSA 公钥算法' },
  { oid: '1.2.840.113549.1.1.5',  name: 'sha1WithRSAEncryption',    desc: 'SHA-1 with RSA 签名' },
  { oid: '1.2.840.113549.1.1.11', name: 'sha256WithRSAEncryption',  desc: 'SHA-256 with RSA 签名' },
  { oid: '1.2.840.113549.1.1.12', name: 'sha384WithRSAEncryption',  desc: 'SHA-384 with RSA 签名' },
  { oid: '1.2.840.113549.1.1.13', name: 'sha512WithRSAEncryption',  desc: 'SHA-512 with RSA 签名' },
  // EC
  { oid: '1.2.840.10045.2.1',     name: 'ecPublicKey',              desc: 'EC 公钥算法' },
  { oid: '1.2.840.10045.4.3.2',   name: 'ecdsa-with-SHA256',        desc: 'ECDSA with SHA-256' },
  { oid: '1.2.840.10045.4.3.3',   name: 'ecdsa-with-SHA384',        desc: 'ECDSA with SHA-384' },
  { oid: '1.2.840.10045.4.3.4',   name: 'ecdsa-with-SHA512',        desc: 'ECDSA with SHA-512' },
  // EC 曲线
  { oid: '1.2.840.10045.3.1.7',   name: 'prime256v1 (P-256)',       desc: 'NIST P-256 椭圆曲线' },
  { oid: '1.3.132.0.34',          name: 'secp384r1 (P-384)',        desc: 'NIST P-384 椭圆曲线' },
  { oid: '1.3.132.0.35',          name: 'secp521r1 (P-521)',        desc: 'NIST P-521 椭圆曲线' },
  // 国密
  { oid: '1.2.156.10197.1.301',   name: 'sm2',                      desc: '国密 SM2 椭圆曲线' },
  { oid: '1.2.156.10197.1.401',   name: 'sm3',                      desc: '国密 SM3 哈希算法' },
  { oid: '1.2.156.10197.1.104',   name: 'sm4',                      desc: '国密 SM4 对称加密' },
  { oid: '1.2.156.10197.1.501',   name: 'sm2-with-SM3',             desc: '国密 SM2 with SM3 签名' },
  // 哈希
  { oid: '1.3.14.3.2.26',         name: 'sha1',                     desc: 'SHA-1 哈希算法' },
  { oid: '2.16.840.1.101.3.4.2.1',name: 'sha256',                   desc: 'SHA-256 哈希算法' },
  { oid: '2.16.840.1.101.3.4.2.2',name: 'sha384',                   desc: 'SHA-384 哈希算法' },
  { oid: '2.16.840.1.101.3.4.2.3',name: 'sha512',                   desc: 'SHA-512 哈希算法' },
  { oid: '1.2.840.113549.2.5',    name: 'md5',                      desc: 'MD5 哈希算法' },
  // X.509 Subject 属性
  { oid: '2.5.4.3',               name: 'commonName (CN)',           desc: '通用名称' },
  { oid: '2.5.4.4',               name: 'surname (SN)',              desc: '姓氏' },
  { oid: '2.5.4.5',               name: 'serialNumber',             desc: '序列号' },
  { oid: '2.5.4.6',               name: 'countryName (C)',           desc: '国家代码（2字母）' },
  { oid: '2.5.4.7',               name: 'localityName (L)',          desc: '城市/地区' },
  { oid: '2.5.4.8',               name: 'stateOrProvinceName (ST)', desc: '省份/州' },
  { oid: '2.5.4.9',               name: 'streetAddress',            desc: '街道地址' },
  { oid: '2.5.4.10',              name: 'organizationName (O)',      desc: '组织名称' },
  { oid: '2.5.4.11',              name: 'organizationalUnitName (OU)', desc: '组织单位' },
  { oid: '2.5.4.12',              name: 'title',                    desc: '职位/头衔' },
  { oid: '2.5.4.42',              name: 'givenName',                desc: '名字' },
  { oid: '1.2.840.113549.1.9.1',  name: 'emailAddress',             desc: '电子邮件地址' },
  // 证书扩展
  { oid: '2.5.29.9',              name: 'subjectDirectoryAttributes', desc: '主题目录属性' },
  { oid: '2.5.29.14',             name: 'subjectKeyIdentifier',     desc: '主题密钥标识符' },
  { oid: '2.5.29.15',             name: 'keyUsage',                 desc: '密钥用法' },
  { oid: '2.5.29.16',             name: 'privateKeyUsagePeriod',    desc: '私钥使用期限' },
  { oid: '2.5.29.17',             name: 'subjectAltName (SAN)',      desc: '主题备用名称' },
  { oid: '2.5.29.18',             name: 'issuerAltName',            desc: '颁发者备用名称' },
  { oid: '2.5.29.19',             name: 'basicConstraints',         desc: '基本约束（是否为CA）' },
  { oid: '2.5.29.20',             name: 'cRLNumber',                desc: 'CRL 编号' },
  { oid: '2.5.29.23',             name: 'instructionCode',          desc: '吊销指令代码' },
  { oid: '2.5.29.24',             name: 'invalidityDate',           desc: '无效日期' },
  { oid: '2.5.29.28',             name: 'issuingDistributionPoint', desc: '颁发分发点' },
  { oid: '2.5.29.31',             name: 'cRLDistributionPoints',    desc: 'CRL 分发点' },
  { oid: '2.5.29.32',             name: 'certificatePolicies',      desc: '证书策略' },
  { oid: '2.5.29.33',             name: 'policyMappings',           desc: '策略映射' },
  { oid: '2.5.29.35',             name: 'authorityKeyIdentifier',   desc: '颁发机构密钥标识符' },
  { oid: '2.5.29.36',             name: 'policyConstraints',        desc: '策略约束' },
  { oid: '2.5.29.37',             name: 'extKeyUsage (EKU)',         desc: '增强型密钥用法' },
  { oid: '2.5.29.46',             name: 'freshestCRL',              desc: '最新 CRL' },
  { oid: '2.5.29.54',             name: 'inhibitAnyPolicy',         desc: '禁止任意策略' },
  // EKU
  { oid: '1.3.6.1.5.5.7.3.1',    name: 'serverAuth',               desc: 'TLS 服务器身份验证' },
  { oid: '1.3.6.1.5.5.7.3.2',    name: 'clientAuth',               desc: 'TLS 客户端身份验证' },
  { oid: '1.3.6.1.5.5.7.3.3',    name: 'codeSigning',              desc: '代码签名' },
  { oid: '1.3.6.1.5.5.7.3.4',    name: 'emailProtection',          desc: '电子邮件保护 (S/MIME)' },
  { oid: '1.3.6.1.5.5.7.3.8',    name: 'timeStamping',             desc: '时间戳' },
  { oid: '1.3.6.1.5.5.7.3.9',    name: 'OCSPSigning',              desc: 'OCSP 签名' },
  // PKCS
  { oid: '1.2.840.113549.1.7.1',  name: 'data',                     desc: 'PKCS#7 数据' },
  { oid: '1.2.840.113549.1.7.2',  name: 'signedData',               desc: 'PKCS#7 签名数据' },
  { oid: '1.2.840.113549.1.7.3',  name: 'envelopedData',            desc: 'PKCS#7 封装数据' },
  { oid: '1.2.840.113549.1.9.14', name: 'extensionRequest',         desc: 'PKCS#9 扩展请求（CSR用）' },
  { oid: '1.2.840.113549.1.12.1.3', name: 'pbeWithSHAAnd3-KeyTripleDES-CBC', desc: 'PFX/PKCS#12 3DES 加密' },
  { oid: '1.2.840.113549.1.12.1.6', name: 'pbeWithSHAAnd40BitRC2-CBC', desc: 'PFX/PKCS#12 RC2 加密' },
  { oid: '1.2.840.113549.1.12.10.1.1', name: 'keyBag',              desc: 'PKCS#12 密钥包' },
  { oid: '1.2.840.113549.1.12.10.1.2', name: 'pkcs8ShroudedKeyBag', desc: 'PKCS#12 加密密钥包' },
  { oid: '1.2.840.113549.1.12.10.1.3', name: 'certBag',             desc: 'PKCS#12 证书包' },
  // AES
  { oid: '2.16.840.1.101.3.4.1.2',  name: 'aes128-CBC',            desc: 'AES-128-CBC 加密' },
  { oid: '2.16.840.1.101.3.4.1.22', name: 'aes192-CBC',            desc: 'AES-192-CBC 加密' },
  { oid: '2.16.840.1.101.3.4.1.42', name: 'aes256-CBC',            desc: 'AES-256-CBC 加密' },
  { oid: '2.16.840.1.101.3.4.1.6',  name: 'aes128-GCM',            desc: 'AES-128-GCM 加密' },
  { oid: '2.16.840.1.101.3.4.1.26', name: 'aes192-GCM',            desc: 'AES-192-GCM 加密' },
  { oid: '2.16.840.1.101.3.4.1.46', name: 'aes256-GCM',            desc: 'AES-256-GCM 加密' },
  // OCSP / AIA
  { oid: '1.3.6.1.5.5.7.48.1',    name: 'ocsp',                    desc: 'OCSP 访问方法' },
  { oid: '1.3.6.1.5.5.7.48.2',    name: 'caIssuers',               desc: 'CA 颁发者访问方法' },
  { oid: '1.3.6.1.5.5.7.1.1',     name: 'authorityInfoAccess',     desc: '颁发机构信息访问 (AIA)' },
]

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return OID_DB.filter(r =>
    r.oid.includes(q) ||
    r.name.toLowerCase().includes(q) ||
    r.desc.toLowerCase().includes(q)
  )
})

function copy(t) { navigator.clipboard.writeText(t); alert('已复制') }
</script>

<template>
  <div class="oid-tool">
    <div class="tool-title">
      <span class="tool-icon">🔍</span>
      <div>
        <div class="tool-name">OID 查询</div>
        <div class="tool-desc">搜索常用 X.509 / PKCS OID 的名称与含义</div>
      </div>
    </div>

    <div class="search-bar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input v-model="query" placeholder="输入 OID、名称或关键词，如 2.5.29.17 / SAN / serverAuth" />
      <button v-if="query" @click="query = ''" class="clear-btn">✕</button>
    </div>

    <div v-if="query" class="result-count">共 {{ results.length }} 条结果</div>

    <div v-if="query" class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:200px">OID</th>
            <th style="width:220px">名称</th>
            <th>说明</th>
            <th style="width:50px"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in results" :key="r.oid">
            <td class="mono">{{ r.oid }}</td>
            <td class="name">{{ r.name }}</td>
            <td class="desc">{{ r.desc }}</td>
            <td><button @click="copy(r.oid)" class="btn-copy">复制</button></td>
          </tr>
          <tr v-if="results.length === 0">
            <td colspan="4" class="empty">未找到匹配的 OID</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.oid-tool { padding: 16px; font-size: 13px; color: #333; }
.tool-title { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid #eee; }
.tool-icon { font-size: 22px; }
.tool-name { font-size: 15px; font-weight: 600; }
.tool-desc { font-size: 12px; color: #888; margin-top: 2px; }
.search-bar { display: flex; align-items: center; gap: 8px; border: 1px solid #e0e0e0; border-radius: 6px; padding: 8px 12px; background: #fff; margin-bottom: 8px; }
.search-bar:focus-within { border-color: #2196F3; box-shadow: 0 0 0 2px rgba(33,150,243,.1); }
.search-bar input { flex: 1; border: none; outline: none; font-size: 13px; }
.clear-btn { border: none; background: none; cursor: pointer; color: #aaa; font-size: 13px; padding: 0 2px; }
.clear-btn:hover { color: #666; }
.result-count { font-size: 11px; color: #aaa; margin-bottom: 8px; }
.table-wrap { overflow-x: auto; border: 1px solid #e8e8e8; border-radius: 6px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
thead { background: #f7f8fa; }
th { padding: 8px 12px; text-align: left; font-weight: 600; color: #555; border-bottom: 1px solid #e8e8e8; white-space: nowrap; }
td { padding: 7px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafafa; }
.mono { font-family: monospace; color: #1565c0; font-size: 11.5px; }
.name { font-weight: 500; color: #333; }
.desc { color: #666; }
.empty { text-align: center; color: #aaa; padding: 24px; }
.btn-copy { padding: 3px 8px; background: #fff; color: #2196F3; border: 1px solid #2196F3; border-radius: 3px; cursor: pointer; font-size: 11px; white-space: nowrap; }
.btn-copy:hover { background: #e3f2fd; }
</style>
