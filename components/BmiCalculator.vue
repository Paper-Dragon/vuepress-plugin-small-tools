<template>
  <div class="bmi-tool">
    <h3>BMI 计算器</h3>
    <div class="input-section">
      <div class="input-group">
        <label>身高（cm）：</label>
        <input type="number" v-model.number="height" min="50" max="250" />
      </div>
      <div class="input-group">
        <label>体重（kg）：</label>
        <input type="number" v-model.number="weight" min="10" max="300" />
      </div>
    </div>
    <button @click="calculateBmi" class="btn-calculate">计算 BMI</button>
    <div v-if="bmiResult" class="result-section">
      <div class="bmi-value">{{ bmiResult.bmi }}</div>
      <div class="bmi-category" :class="bmiResult.categoryClass">{{ bmiResult.category }}</div>
      <div class="bmi-range">
        <div class="range-item"><span>偏瘦</span><span>&lt;18.5</span></div>
        <div class="range-item"><span>正常</span><span>18.5-24</span></div>
        <div class="range-item"><span>偏胖</span><span>24-28</span></div>
        <div class="range-item"><span>肥胖</span><span>&gt;28</span></div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      height: 170,
      weight: 65,
      bmiResult: null
    }
  },
  methods: {
    calculateBmi() {
      const heightM = this.height / 100
      const bmi = this.weight / (heightM * heightM)
      let category = ''
      let categoryClass = ''
      
      if (bmi < 18.5) {
        category = '偏瘦'
        categoryClass = 'thin'
      } else if (bmi < 24) {
        category = '正常'
        categoryClass = 'normal'
      } else if (bmi < 28) {
        category = '偏胖'
        categoryClass = 'overweight'
      } else {
        category = '肥胖'
        categoryClass = 'obese'
      }
      
      this.bmiResult = {
        bmi: bmi.toFixed(1),
        category: category,
        categoryClass: categoryClass
      }
    }
  }
}
</script>

<style scoped>
.bmi-tool { padding: 20px; max-width: 500px; margin: 0 auto; text-align: center; }
h3 { margin-bottom: 20px; }
.input-section { display: flex; flex-direction: column; gap: 15px; }
.input-group { display: flex; flex-direction: column; gap: 5px; text-align: left; }
.input-group label { font-weight: bold; color: #555; }
.input-group input { padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px; }
.btn-calculate { width: 100%; padding: 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; margin-top: 15px; }
.result-section { margin-top: 30px; }
.bmi-value { font-size: 72px; font-weight: bold; color: #2196F3; }
.bmi-category { font-size: 24px; padding: 10px 20px; border-radius: 8px; display: inline-block; margin: 10px 0; }
.bmi-category.thin { background: #e3f2fd; color: #1976D2; }
.bmi-category.normal { background: #e8f5e9; color: #388E3C; }
.bmi-category.overweight { background: #fff3e0; color: #F57C00; }
.bmi-category.obese { background: #ffebee; color: #D32F2F; }
.bmi-range { margin-top: 20px; display: flex; justify-content: center; gap: 15px; flex-wrap: wrap; }
.range-item { display: flex; flex-direction: column; padding: 8px 15px; background: #f5f5f5; border-radius: 4px; font-size: 12px; }
.range-item span:first-child { font-weight: bold; }
</style>
