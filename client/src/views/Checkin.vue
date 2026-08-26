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
          :title="selectedVehicle.plateNumber"
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
        <div class="flex-between mb-12">
          <span class="section-title" style="margin-bottom:0">接车照片</span>
          <span class="text-muted">{{ photos.length }}/9 张</span>
        </div>
        <div class="photo-uploader">
          <div
            v-for="(photo, idx) in photos"
            :key="idx"
            class="photo-item-wrapper"
          >
            <img
              v-if="photo.status !== 'failed'"
              :src="photo.content || photo.url"
              class="photo-thumb"
              @click="previewPhoto(idx)"
            />
            <!-- 上传中遮罩 -->
            <div v-if="photo.status === 'uploading'" class="photo-mask">
              <van-loading type="spinner" size="24" color="#fff" />
              <span class="photo-mask-text">上传中</span>
            </div>
            <!-- 上传失败 -->
            <div v-if="photo.status === 'failed'" class="photo-mask photo-failed">
              <van-icon name="warning-o" size="24" color="#fff" />
              <span class="photo-mask-text">上传失败</span>
              <span class="photo-retry" @click.stop="retryUpload(idx)">重试</span>
            </div>
            <!-- 删除按钮 -->
            <van-icon
              v-if="photo.status !== 'uploading'"
              name="cross"
              class="photo-delete"
              @click.stop="deletePhoto(idx)"
            />
          </div>
          <!-- 添加按钮 -->
          <div
            v-if="photos.length < 9"
            class="photo-add"
            @click="triggerFileInput"
          >
            <van-icon name="photograph" size="28" color="#c8c9cc" />
            <span class="photo-add-text">拍照/相册</span>
          </div>
        </div>
        <!-- 隐藏的文件输入 -->
        <input
          ref="fileInputRef"
          type="file"
          accept="image/*"
          multiple
          style="display:none"
          @change="onFileChange"
        />
        <!-- 图片预览 -->
        <van-image-preview
          v-model:show="showPhotoPreview"
          :images="previewImages"
          :start-position="previewIndex"
          @change="onPreviewChange"
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
          :title="v.plateNumber"
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
        <van-field v-model="newVehicle.plateNumber" label="车牌号" placeholder="请输入车牌号" />
        <van-field v-model="newVehicle.brand" label="品牌" placeholder="如丰田" />
        <van-field v-model="newVehicle.model" label="车型" placeholder="如卡罗拉" />
        <van-button type="primary" block class="mt-16" @click="submitNewVehicle">保存</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { useRouter } from 'vue-router'
import { getCustomers, createCustomer, getVehicles, createVehicle, createCheckin, uploadImage } from '@/api'

const router = useRouter()

const selectedCustomer = ref<any>(null)
const selectedVehicle = ref<any>(null)
const customerList = ref<any[]>([])
const vehicleList = ref<any[]>([])
const customerKeyword = ref('')
// 照片列表，每项包含：content(本地预览)、url(服务器路径)、status(uploading/done/failed)、file(原始文件)
const photos = ref<any[]>([])

// 照片预览相关
const fileInputRef = ref<HTMLInputElement>()
const showPhotoPreview = ref(false)
const previewImages = ref<string[]>([])
const previewIndex = ref(0)

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
const newVehicle = reactive({ plateNumber: '', brand: '', model: '' })

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
  if (!newVehicle.plateNumber) return showToast('请输入车牌号')
  try {
    const v = await createVehicle({ ...newVehicle, customerId: selectedCustomer.value.id })
    selectedVehicle.value = v
    showNewVehicle.value = false
    newVehicle.plateNumber = ''
    newVehicle.brand = ''
    newVehicle.model = ''
    loadVehicles()
  } catch (e) { /* 已拦截 */ }
}

// ===== 照片上传相关 =====

// 触发文件选择
const triggerFileInput = () => {
  if (photos.value.length >= 9) {
    showToast('最多上传9张照片')
    return
  }
  fileInputRef.value?.click()
}

// 文件选择后处理
const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement
  const files = input.files
  if (!files || files.length === 0) return

  const remaining = 9 - photos.value.length
  const filesToUpload = Array.from(files).slice(0, remaining)

  for (const file of filesToUpload) {
    // 校验文件类型
    if (!file.type.startsWith('image/')) {
      showToast('只能上传图片文件')
      continue
    }
    // 校验文件大小（10MB）
    if (file.size > 10 * 1024 * 1024) {
      showToast('图片大小不能超过10MB')
      continue
    }
    // 添加到列表并上传
    const reader = new FileReader()
    reader.onload = (ev) => {
      const photoItem = {
        content: ev.target?.result as string,
        url: '',
        status: 'uploading',
        file
      }
      photos.value.push(photoItem)
      uploadPhoto(photoItem)
    }
    reader.readAsDataURL(file)
  }

  // 清空 input，允许重复选择同一文件
  input.value = ''
}

// 上传单张照片
const uploadPhoto = async (photoItem: any) => {
  try {
    const res: any = await uploadImage(photoItem.file)
    photoItem.url = res.url
    photoItem.status = 'done'
  } catch (e) {
    photoItem.status = 'failed'
    showToast({ type: 'fail', message: '照片上传失败，点击重试' })
  }
}

// 重试上传
const retryUpload = (idx: number) => {
  const photoItem = photos.value[idx]
  if (!photoItem || !photoItem.file) return
  photoItem.status = 'uploading'
  uploadPhoto(photoItem)
}

// 删除照片
const deletePhoto = async (idx: number) => {
  try {
    await showConfirmDialog({
      title: '删除照片',
      message: '确定删除这张照片吗？'
    })
    photos.value.splice(idx, 1)
  } catch (e) {
    // 用户取消
  }
}

// 预览照片
const previewPhoto = (idx: number) => {
  const donePhotos = photos.value
    .filter((p: any) => p.status === 'done' && p.url)
    .map((p: any) => p.url)
  if (donePhotos.length === 0) return
  previewImages.value = donePhotos
  // 计算在已完成照片中的索引
  const doneIdx = photos.value
    .slice(0, idx + 1)
    .filter((p: any) => p.status === 'done' && p.url)
    .length - 1
  previewIndex.value = Math.max(0, doneIdx)
  showPhotoPreview.value = true
}

const onPreviewChange = (idx: number) => {
  previewIndex.value = idx
}

const submit = async () => {
  if (!selectedCustomer.value) return showToast('请选择客户')
  if (!selectedVehicle.value) return showToast('请选择车辆')
  if (!form.complaint) return showToast('请输入客户诉求')

  // 检查是否有上传中的照片
  const uploading = photos.value.some((p: any) => p.status === 'uploading')
  if (uploading) return showToast('照片正在上传中，请稍候')

  // 检查是否有上传失败的照片
  const failed = photos.value.filter((p: any) => p.status === 'failed')
  if (failed.length > 0) {
    try {
      await showConfirmDialog({
        title: '上传失败',
        message: `有${failed.length}张照片上传失败，是否忽略并继续？`
      })
    } catch (e) {
      return // 用户取消
    }
  }

  try {
    // 只收集上传成功的照片URL
    const photoPaths = photos.value
      .filter((p: any) => p.status === 'done' && p.url)
      .map((p: any) => p.url)

    const order = await createCheckin({
      customerId: selectedCustomer.value.id,
      vehicleId: selectedVehicle.value.id,
      complaint: form.complaint,
      mileageIn: form.mileage ? Number(form.mileage) : null,
      vehicleCondition: form.vehicleCondition,
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
/* 照片上传区域 */
.photo-uploader {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.photo-item-wrapper {
  position: relative;
  width: calc((100% - 24px) / 4);
  aspect-ratio: 1;
  border-radius: 6px;
  overflow: hidden;
  background: #f7f8fa;
}
.photo-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
  cursor: pointer;
}
.photo-mask {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.photo-mask-text {
  color: #fff;
  font-size: 11px;
}
.photo-failed {
  background: rgba(238,10,36,0.6);
}
.photo-retry {
  color: #fff;
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
  margin-top: 2px;
}
.photo-delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 20px;
  height: 20px;
  background: rgba(0,0,0,0.5);
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  z-index: 2;
}
.photo-add {
  width: calc((100% - 24px) / 4);
  aspect-ratio: 1;
  border: 1px dashed #dcdee0;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  background: #fafafa;
}
.photo-add:active {
  background: #f2f3f5;
}
.photo-add-text {
  font-size: 11px;
  color: #969799;
}
</style>
