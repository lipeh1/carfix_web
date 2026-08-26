<template>
  <div class="page-container">
    <van-nav-bar title="接车登记" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content">
      <!-- 客户选择 -->
      <div class="card">
        <div class="section-title">客户信息</div>
        <van-cell
          v-if="selectedCustomer"
          :title="selectedCustomer.name"
          :label="selectedCustomer.phone"
          is-link
          @click="showCustomerPicker = true"
        >
          <template #right-icon><van-icon name="arrow" /></template>
        </van-cell>
        <van-cell v-else title="选择客户" is-link @click="showCustomerPicker = true">
          <template #right-icon><span class="text-muted">请选择</span></template>
        </van-cell>
        <van-button size="small" plain type="primary" class="mt-8" @click="showNewCustomer = true">
          + 新建客户
        </van-button>
      </div>

      <!-- 车辆选择 -->
      <div class="card" v-if="selectedCustomer">
        <div class="section-title">车辆信息</div>
        <van-cell
          v-if="selectedVehicle"
          :title="selectedVehicle.plate_number"
          :label="`${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}`"
          is-link
          @click="showVehiclePicker = true"
        />
        <van-cell v-else title="选择车辆" is-link @click="showVehiclePicker = true">
          <template #right-icon><span class="text-muted">请选择</span></template>
        </van-cell>
        <van-button size="small" plain type="primary" class="mt-8" @click="showNewVehicle = true">
          + 新建车辆
        </van-button>
      </div>

      <!-- 接车信息 -->
      <div class="card">
        <div class="section-title">接车信息</div>
        <van-field v-model="form.complaint" label="客户诉求" type="textarea" rows="2" placeholder="描述故障或需求" />
        <van-field v-model="form.mileage" label="当前里程" type="digit" placeholder="公里数" />
        <van-field v-model="form.vehicleCondition" label="车况描述" type="textarea" rows="2" placeholder="可选" />
      </div>

      <!-- 接车照片 -->
      <div class="card">
        <div class="section-title">接车照片</div>
        <van-uploader
          v-model="photos"
          :max-count="9"
          :after-read="afterRead"
          multiple
        />
      </div>

      <!-- 提交 -->
      <van-button type="primary" block @click="submit">创建工单</van-button>
    </div>

    <!-- 客户选择弹窗 -->
    <van-popup v-model:show="showCustomerPicker" position="bottom" round>
      <div class="popup-content">
        <h3>选择客户</h3>
        <van-search v-model="customerKeyword" placeholder="搜索姓名/电话" @search="loadCustomers" @clear="loadCustomers" show-action>
          <template #action>
            <div @click="loadCustomers">搜索</div>
          </template>
        </van-search>
        <van-cell
          v-for="c in customerList"
          :key="c.id"
          :title="c.name"
          :label="c.phone"
          is-link
          @click="selectCustomer(c)"
        />
        <van-empty v-if="customerList.length === 0" description="暂无客户" />
      </div>
    </van-popup>

    <!-- 车辆选择弹窗 -->
    <van-popup v-model:show="showVehiclePicker" position="bottom" round>
      <div class="popup-content">
        <h3>选择车辆</h3>
        <van-cell
          v-for="v in vehicleList"
          :key="v.id"
          :title="v.plate_number"
          :label="`${v.brand || ''} ${v.model || ''}`"
          is-link
          @click="selectVehicle(v)"
        />
        <van-empty v-if="vehicleList.length === 0" description="暂无车辆" />
      </div>
    </van-popup>

    <!-- 新建客户弹窗 -->
    <van-popup v-model:show="showNewCustomer" position="bottom" round>
      <div class="popup-content">
        <h3>新建客户</h3>
        <van-field v-model="newCustomer.name" label="姓名" placeholder="请输入姓名" />
        <van-field v-model="newCustomer.phone" label="电话" placeholder="请输入电话" type="tel" />
        <van-button type="primary" block class="mt-16" @click="submitNewCustomer">保存</van-button>
      </div>
    </van-popup>

    <!-- 新建车辆弹窗 -->
    <van-popup v-model:show="showNewVehicle" position="bottom" round>
      <div class="popup-content">
        <h3>新建车辆</h3>
        <van-field v-model="newVehicle.plate_number" label="车牌号" placeholder="请输入车牌号" />
        <van-field v-model="newVehicle.brand" label="品牌" placeholder="如丰田" />
        <van-field v-model="newVehicle.model" label="车型" placeholder="如卡罗拉" />
        <van-button type="primary" block class="mt-16" @click="submitNewVehicle">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { showToast } from 'vant'
import { useRouter } from 'vue-router'
import { getCustomers, createCustomer, getVehicles, createVehicle, createCheckin, uploadImage } from '@/api'

const router = useRouter()

const selectedCustomer = ref<any>(null)
const selectedVehicle = ref<any>(null)
const customerList = ref<any[]>([])
const vehicleList = ref<any[]>([])
const customerKeyword = ref('')
const photos = ref<any[]>([])

const showCustomerPicker = ref(false)
const showVehiclePicker = ref(false)
const showNewCustomer = ref(false)
const showNewVehicle = ref(false)

const form = reactive({
  complaint: '',
  mileage: '',
  vehicleCondition: ''
})

const newCustomer = reactive({ name: '', phone: '' })
const newVehicle = reactive({ plate_number: '', brand: '', model: '' })

const loadCustomers = async () => {
  try {
    const data = await getCustomers({ keyword: customerKeyword.value })
    customerList.value = data as any[]
  } catch (e) { /* 静默 */ }
}

const loadVehicles = async () => {
  if (!selectedCustomer.value) return
  try {
    const data = await getVehicles({ customerId: selectedCustomer.value.id })
    vehicleList.value = data as any[]
  } catch (e) { /* 静默 */ }
}

const selectCustomer = (c: any) => {
  selectedCustomer.value = c
  selectedVehicle.value = null
  showCustomerPicker.value = false
  loadVehicles()
}

const selectVehicle = (v: any) => {
  selectedVehicle.value = v
  showVehiclePicker.value = false
}

const submitNewCustomer = async () => {
  if (!newCustomer.name) return showToast('请输入姓名')
  if (!newCustomer.phone) return showToast('请输入电话')
  try {
    const c = await createCustomer(newCustomer)
    selectedCustomer.value = c
    showNewCustomer.value = false
    newCustomer.name = ''
    newCustomer.phone = ''
    loadCustomers()
    loadVehicles()
  } catch (e) { /* 已拦截 */ }
}

const submitNewVehicle = async () => {
  if (!selectedCustomer.value) return showToast('请先选择客户')
  if (!newVehicle.plate_number) return showToast('请输入车牌号')
  try {
    const v = await createVehicle({ ...newVehicle, customer_id: selectedCustomer.value.id })
    selectedVehicle.value = v
    showNewVehicle.value = false
    newVehicle.plate_number = ''
    newVehicle.brand = ''
    newVehicle.model = ''
    loadVehicles()
  } catch (e) { /* 已拦截 */ }
}

const afterRead = async (file: any) => {
  try {
    const res = await uploadImage(file.file)
    file.status = 'done'
    file.url = (res as any).url
  } catch (e) {
    file.status = 'failed'
  }
}

const submit = async () => {
  if (!selectedCustomer.value) return showToast('请选择客户')
  if (!selectedVehicle.value) return showToast('请选择车辆')
  if (!form.complaint) return showToast('请输入客户诉求')

  try {
    const photoPaths = photos.value
      .filter((p: any) => p.url)
      .map((p: any) => p.url)

    const order = await createCheckin({
      customer_id: selectedCustomer.value.id,
      vehicle_id: selectedVehicle.value.id,
      complaint: form.complaint,
      mileage_in: form.mileage ? Number(form.mileage) : null,
      vehicle_condition: form.vehicleCondition,
      photos: photoPaths
    })

    showToast({ type: 'success', message: '工单创建成功' })
    setTimeout(() => {
      router.push(`/orders/${(order as any).id}`)
    }, 800)
  } catch (e) {
    // 已拦截
  }
}

onMounted(loadCustomers)
</script>

<style scoped>
.popup-content {
  padding: 20px 16px 32px;
  max-height: 70vh;
  overflow-y: auto;
}
.popup-content h3 {
  text-align: center;
  margin-bottom: 12px;
}
</style>
