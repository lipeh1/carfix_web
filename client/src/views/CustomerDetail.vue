<template>
  <div class="page-container">
    <van-nav-bar title="客户详情" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content" v-if="customer">
      <div class="card">
        <van-cell title="姓名" :value="customer.name" />
        <van-cell title="电话" :value="customer.phone" />
        <van-cell title="备注" :value="customer.remark || '-'" />
        <van-cell title="创建时间" :value="formatDate(customer.created_at)" />
      </div>

      <div class="card">
        <div class="section-title">名下车辆</div>
        <van-cell
          v-for="v in customer.vehicles"
          :key="v.id"
          :title="v.plate_number"
          :label="`${v.brand || ''} ${v.model || ''}`"
          is-link
          @click="$router.push(`/vehicles/${v.id}`)"
        />
        <van-empty v-if="!customer.vehicles?.length" description="暂无车辆" />
      </div>

      <div class="card">
        <div class="section-title">历史工单</div>
        <van-cell
          v-for="o in customer.work_orders"
          :key="o.id"
          :title="o.order_no"
          :label="o.complaint"
          is-link
          @click="$router.push(`/orders/${o.id}`)"
        >
          <template #value>
            <van-tag >{{ o.status }}</van-tag>
          </template>
        </van-cell>
        <van-empty v-if="!customer.work_orders?.length" description="暂无工单" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getCustomer } from '@/api'
import dayjs from 'dayjs'

const route = useRoute()
const customer = ref<any>(null)
const formatDate = (d: string) => dayjs(d).format('YYYY-MM-DD')

onMounted(async () => {
  try {
    customer.value = await getCustomer(Number(route.params.id))
  } catch (e) { /* 静默 */ }
})
</script>
