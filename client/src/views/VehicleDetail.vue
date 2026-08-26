<template>
  <div class="page-container">
    <van-nav-bar title="车辆详情" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content" v-if="vehicle">
      <div class="card">
        <van-cell title="车牌号" :value="vehicle.plate_number" />
        <van-cell title="品牌" :value="vehicle.brand || '-'" />
        <van-cell title="车型" :value="vehicle.model || '-'" />
        <van-cell title="年份" :value="vehicle.year || '-'" />
        <van-cell title="VIN" :value="vehicle.vin || '-'" />
        <van-cell title="备注" :value="vehicle.remark || '-'" />
      </div>

      <div class="card" v-if="vehicle.customer">
        <div class="section-title">所属客户</div>
        <van-cell
          :title="vehicle.customer.name"
          :label="vehicle.customer.phone"
          is-link
          @click="$router.push(`/customers/${vehicle.customer.id}`)"
        />
      </div>

      <div class="card">
        <div class="section-title">维修历史</div>
        <van-cell
          v-for="o in vehicle.work_orders"
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
        <van-empty v-if="!vehicle.work_orders?.length" description="暂无维修记录" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { getVehicle } from '@/api'

const route = useRoute()
const vehicle = ref<any>(null)

onMounted(async () => {
  try {
    vehicle.value = await getVehicle(Number(route.params.id))
  } catch (e) { /* 静默 */ }
})
</script>
