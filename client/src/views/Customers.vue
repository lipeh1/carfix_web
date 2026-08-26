<template>
  <div class="page-container">
    <van-nav-bar title="客户">
      <template #right>
        <van-icon name="add" size="20" @click="showAdd = true" />
      </template>
    </van-nav-bar>

    <van-search v-model="keyword" placeholder="搜索姓名/电话" @search="onSearch" />

    <div class="page-content">
      <van-cell
        v-for="c in customers"
        :key="c.id"
        :title="c.name"
        :label="c.phone"
        is-link
        @click="$router.push(`/customers/${c.id}`)"
      >
        <template #right-icon>
          <span class="text-muted">{{ c._vehicle_count || 0 }}辆车</span>
        </template>
      </van-cell>

      <van-empty v-if="customers.length === 0 && !loading" description="暂无客户" />
    </div>

    <!-- 新增客户弹窗 -->
    <van-popup v-model:show="showAdd" position="bottom" round>
      <div class="popup-content">
        <h3>新增客户</h3>
        <van-field v-model="form.name" label="姓名" placeholder="请输入姓名" />
        <van-field v-model="form.phone" label="电话" placeholder="请输入电话" type="tel" />
        <van-field v-model="form.remark" label="备注" placeholder="可选" type="textarea" rows="2" />
        <van-button type="primary" block class="mt-16" @click="submitAdd">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { showToast } from 'vant'
import { getCustomers, createCustomer } from '@/api'

const customers = ref<any[]>([])
const keyword = ref('')
const loading = ref(false)
const showAdd = ref(false)
const form = reactive({ name: '', phone: '', remark: '' })

const loadData = async () => {
  loading.value = true
  try {
    const data = await getCustomers({ keyword: keyword.value })
    customers.value = data as any[]
  } catch (e) {
    // 静默
  } finally {
    loading.value = false
  }
}

const onSearch = () => loadData()

const submitAdd = async () => {
  if (!form.name) return showToast('请输入姓名')
  if (!form.phone) return showToast('请输入电话')
  try {
    await createCustomer(form)
    showToast({ type: 'success', message: '添加成功' })
    showAdd.value = false
    form.name = ''
    form.phone = ''
    form.remark = ''
    loadData()
  } catch (e) {
    // 已拦截
  }
}

onMounted(loadData)
</script>

<style scoped>
.popup-content {
  padding: 20px 16px 32px;
}
.popup-content h3 {
  text-align: center;
  margin-bottom: 16px;
}
</style>
