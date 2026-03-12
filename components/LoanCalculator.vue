<template>
  <div class="loan-tool">
    <h3>房贷计算器</h3>
    <div class="input-section">
      <div class="input-group">
        <label>贷款金额（万元）：</label>
        <input type="number" v-model.number="loanAmount" min="1" />
      </div>
      <div class="input-group">
        <label>贷款期限（年）：</label>
        <input type="number" v-model.number="loanYears" min="1" max="30" />
      </div>
      <div class="input-group">
        <label>年利率（%）：</label>
        <input type="number" v-model.number="interestRate" step="0.01" min="0" max="20" />
      </div>
      <div class="input-group">
        <label>还款方式：</label>
        <select v-model="repaymentType">
          <option value="equal-principal">等额本息</option>
          <option value="equal-principal-interest">等额本金</option>
        </select>
      </div>
    </div>
    <button @click="calculate" class="btn-calculate">计算</button>
    <div v-if="result" class="result-section">
      <div class="result-item">
        <span class="label">每月还款：</span>
        <span class="value">{{ result.monthlyPayment }} 元</span>
      </div>
      <div class="result-item">
        <span class="label">总利息：</span>
        <span class="value">{{ result.totalInterest }} 元</span>
      </div>
      <div class="result-item">
        <span class="label">总还款：</span>
        <span class="value">{{ result.totalPayment }} 元</span>
      </div>
      <div v-if="repaymentType === 'equal-principal-interest'" class="result-detail">
        <h4>每月还款明细：</h4>
        <table>
          <thead><tr><th>月份</th><th>本金</th><th>利息</th><th>合计</th></tr></thead>
          <tbody>
            <tr v-for="(month, index) in result.monthlyDetails.slice(0, 12)" :key="index">
              <td>{{ index + 1 }}</td>
              <td>{{ month.principal.toFixed(2) }}</td>
              <td>{{ month.interest.toFixed(2) }}</td>
              <td>{{ month.total.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="result.monthlyDetails.length > 12">... 共 {{ result.monthlyDetails.length }} 个月</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      loanAmount: 100,
      loanYears: 20,
      interestRate: 4.9,
      repaymentType: 'equal-principal',
      result: null
    }
  },
  methods: {
    calculate() {
      const principal = this.loanAmount * 10000
      const months = this.loanYears * 12
      const monthlyRate = this.interestRate / 100 / 12
      
      if (this.repaymentType === 'equal-principal') {
        // 等额本息
        const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, months) / (Math.pow(1 + monthlyRate, months) - 1)
        const totalPayment = monthlyPayment * months
        const totalInterest = totalPayment - principal
        this.result = {
          monthlyPayment: monthlyPayment.toFixed(2),
          totalInterest: totalInterest.toFixed(2),
          totalPayment: totalPayment.toFixed(2),
          monthlyDetails: []
        }
      } else {
        // 等额本金
        const monthlyPrincipal = principal / months
        const monthlyDetails = []
        let totalInterest = 0
        for (let i = 0; i < months; i++) {
          const interest = (principal - monthlyPrincipal * i) * monthlyRate
          totalInterest += interest
          monthlyDetails.push({
            principal: monthlyPrincipal,
            interest: interest,
            total: monthlyPrincipal + interest
          })
        }
        const firstPayment = monthlyDetails[0].total
        this.result = {
          monthlyPayment: firstPayment.toFixed(2),
          totalInterest: totalInterest.toFixed(2),
          totalPayment: (principal + totalInterest).toFixed(2),
          monthlyDetails: monthlyDetails
        }
      }
    }
  }
}
</script>

<style scoped>
.loan-tool { padding: 20px; max-width: 700px; margin: 0 auto; }
h3 { text-align: center; }
.input-section { display: flex; flex-direction: column; gap: 15px; }
.input-group { display: flex; flex-direction: column; gap: 5px; }
.input-group label { font-weight: bold; color: #555; }
.input-group input, .input-group select { padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
.btn-calculate { width: 100%; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 15px; font-size: 16px; }
.result-section { margin-top: 20px; }
.result-item { display: flex; justify-content: space-between; padding: 15px; background: #f5f5f5; border-radius: 4px; margin: 10px 0; }
.result-item .label { font-weight: bold; }
.result-item .value { color: #2196F3; font-size: 18px; font-weight: bold; }
.result-detail { margin-top: 20px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { padding: 8px; border: 1px solid #ddd; text-align: center; }
th { background: #f0f0f0; }
</style>
