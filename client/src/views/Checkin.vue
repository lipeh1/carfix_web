<template>
  <div class="page-container">
    <van-nav-bar title="接车登记" left-text="返回" left-arrow @click-left="$router.back()" />

    <div class="page-content">
      <!-- 客户选择 -->
      <div class="card">
        <div class="section-title">客户信息</div>
        <!-- 扫行驶证一次建档：识别所有人/车牌/品牌型号/VIN，电话需人工补录 -->
        <div class="scan-entry" @click="triggerLicenseScan">
          <van-icon name="scan" size="16" />
          <span>扫行驶证建档</span>
        </div>
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
        <!-- 常用诉求标签：点击追加，减少手打 -->
        <div class="complaint-tags">
          <span
            v-for="t in complaintTags"
            :key="t"
            class="complaint-tag"
            :class="{ active: form.complaint.includes(t) }"
            @click="appendComplaint(t)"
          >{{ t }}</span>
        </div>
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
            <van-icon name="photograph" size="28" />
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
        <!-- 最近到店快捷区：点一下同时选客户（单车自动带出车辆） -->
        <div class="recent-section" v-if="recentCustomers.length > 0">
          <div class="recent-title">最近到店</div>
          <div class="recent-list">
            <div
              v-for="c in recentCustomers"
              :key="c.id"
              class="recent-item"
              @click="selectCustomer(c)"
            >
              <div class="recent-name">{{ c.name }}</div>
              <div class="recent-meta">{{ c._count?.vehicles || 0 }}辆车 · {{ c.phone }}</div>
            </div>
          </div>
        </div>
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
        <!-- 拍车牌快速定位已建档车辆（跨客户） -->
        <div class="scan-entry" @click="triggerPlateScan">
          <van-icon name="photograph" size="16" />
          <span>拍车牌找车</span>
        </div>
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
        <van-field v-model="newCustomer.address" label="住址" placeholder="可选，行驶证可识别" />
        <van-button type="primary" block class="mt-16" @click="submitNewCustomer">保存</van-button>
      </div>
    </van-popup>

    <!-- 新建车辆弹窗 -->
    <van-popup v-model:show="showNewVehicle" position="bottom" round>
      <div class="popup-content">
        <h3>新建车辆</h3>
        <!-- 车牌走专用键盘，避免系统中英文切换与小写脏数据 -->
        <van-field
          v-model="newVehicle.plateNumber"
          label="车牌号"
          placeholder="点击输入车牌"
          readonly
          is-link
          @click="showPlateKeyboard = true"
        />
        <van-field v-model="newVehicle.brand" label="品牌" placeholder="如丰田" />
        <van-field v-model="newVehicle.model" label="车型" placeholder="如卡罗拉" />
        <van-field v-model="newVehicle.vin" label="VIN" placeholder="选填，行驶证可识别" />
        <van-button type="primary" block class="mt-16" @click="submitNewVehicle">保存</van-button>
      </div>
    </van-popup>

    <!-- 车牌专用键盘 -->
    <PlateKeyboard v-model="newVehicle.plateNumber" v-model:show="showPlateKeyboard" />

    <!-- 扫证件/车牌的隐藏拍照入口（capture 直接拉起相机，兼容微信内浏览器） -->
    <input
      ref="licenseInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      style="display:none"
      @change="onLicenseScan"
    />
    <input
      ref="plateInputRef"
      type="file"
      accept="image/*"
      capture="environment"
      style="display:none"
      @change="onPlateScan"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { useRouter } from 'vue-router'
import { getCustomers, createCustomer, getVehicles, createVehicle, createCheckin, uploadImage, deleteUpload, ocrVehicleLicense, ocrPlate } from '@/api'
import { compressImage } from '@/utils/image'
import { isValidPlate } from '@/utils/plate'
import { saveDraft, loadDraft, clearDraft, draftHasContent } from '@/utils/draft'

// 接车表单草稿键
const DRAFT_KEY = 'checkin'

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
const showPlateKeyboard = ref(false)

const form = reactive({
  complaint: '',
  mileage: '',
  vehicleCondition: ''
})

// 常见诉求标签：点选追加，覆盖高频口述场景
const complaintTags = ['异响', '抖动', '故障灯亮', '保养到期', '漏油', '空调不制冷', '刹车异常', '启动困难']

// 追加诉求标签：已包含则忽略，多个标签用顿号连接
const appendComplaint = (tag: string) => {
  if (form.complaint.includes(tag)) return
  form.complaint = form.complaint ? `${form.complaint}、${tag}` : tag
}

const newCustomer = reactive({ name: '', phone: '', address: '' })
const newVehicle = reactive({ plateNumber: '', brand: '', model: '', vin: '' })

// 扫描输入引用与识别中状态
const licenseInputRef = ref<HTMLInputElement>()
const plateInputRef = ref<HTMLInputElement>()
const scanning = ref(false)

// 最近到店快捷区：取排序后的前三个有到店记录的客户
const recentCustomers = computed(() =>
  customerList.value.filter((c: any) => c.lastVisitAt).slice(0, 3)
)

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

const selectCustomer = async (c: any) => {
  selectedCustomer.value = c
  selectedVehicle.value = null
  showCustomerPicker.value = false
  await loadVehicles()
  // 名下只有一辆车时自动选中，省去第二层选择弹窗
  if (vehicleList.value.length === 1) {
    selectedVehicle.value = vehicleList.value[0]
    showToast({ type: 'success', message: `已选择 ${c.name} · ${selectedVehicle.value.plateNumber}` })
  }
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
    newCustomer.address = ''
    loadCustomers()
    loadVehicles()
    // 扫行驶证建档流程：客户保存后车辆表单已预填，直接带出建车弹窗
    if (newVehicle.plateNumber) {
      showNewVehicle.value = true
    }
  } catch (e) { /* 已拦截 */ }
}

const submitNewVehicle = async () => {
  if (!selectedCustomer.value) return showToast('请先选择客户')
  const plate = newVehicle.plateNumber.trim().toUpperCase()
  if (!plate) return showToast('请输入车牌号')
  if (!isValidPlate(plate)) return showToast('车牌格式不正确（普通牌7位，新能源8位）')
  try {
    const v = await createVehicle({ ...newVehicle, plateNumber: plate, customerId: selectedCustomer.value.id })
    selectedVehicle.value = v
    showNewVehicle.value = false
    newVehicle.plateNumber = ''
    newVehicle.brand = ''
    newVehicle.model = ''
    newVehicle.vin = ''
    loadVehicles()
  } catch (e) { /* 已拦截 */ }
}

// ===== OCR 扫描（后端代理百度，未配密钥/识别失败均不阻塞手输） =====

// 行驶证品牌型号解析："大众牌FV7160AAWG" → 品牌=大众 / 型号=FV7160AAWG
const parseBrandModel = (s: string | null): { brand: string; model: string } => {
  if (!s) return { brand: '', model: '' }
  const m = s.match(/^([\u4e00-\u9fa5]+)牌/)
  const brand = m ? m[1] : ''
  const model = s.replace(/^([\u4e00-\u9fa5]+)牌?/, '')
  return { brand, model }
}

const triggerLicenseScan = () => {
  licenseInputRef.value?.click()
}

// 拍行驶证 → 识别 → 预填新建客户/车辆表单（电话需人工补录）
const onLicenseScan = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || scanning.value) return
  scanning.value = true
  try {
    const compressed = await compressImage(file)
    const res: any = await ocrVehicleLicense(compressed)
    if (!res.plateNumber && !res.owner) {
      return showToast('未能识别出行驶证内容，请正对证件、避免反光后重试')
    }
    // 预填两个表单，客户弹窗先出（补电话），保存后自动衔接建车弹窗
    newCustomer.name = res.owner || ''
    newCustomer.phone = ''
    newCustomer.address = res.address || ''
    newVehicle.plateNumber = (res.plateNumber || '').toUpperCase()
    const { brand, model } = parseBrandModel(res.brandModel)
    newVehicle.brand = brand
    newVehicle.model = model
    newVehicle.vin = res.vin || ''
    showNewCustomer.value = true
    showToast({ type: 'success', message: '已识别，请补录客户电话' })
  } catch (err: any) {
    // 具体原因已由请求拦截器 toast（未配置/网络/识别失败），此处保持手输路径
  } finally {
    scanning.value = false
  }
}

const triggerPlateScan = () => {
  plateInputRef.value?.click()
}

// 拍车牌 → 全库找车 → 命中则同时选中客户与车辆
const onPlateScan = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || scanning.value) return
  scanning.value = true
  try {
    const compressed = await compressImage(file)
    const res: any = await ocrPlate(compressed)
    const plate = String(res.number || '').toUpperCase()
    if (!plate) return showToast('未识别到车牌，请重试')
    // 跨客户按车牌找车
    const list: any[] = await getVehicles({ keyword: plate }) as any[]
    const hit = list.find(v => (v.plateNumber || '').toUpperCase() === plate)
    if (!hit) {
      showToast(`车牌 ${plate} 未建档，可用「扫行驶证建档」`)
      return
    }
    selectedCustomer.value = hit.customer
    selectedVehicle.value = hit
    showVehiclePicker.value = false
    await loadVehicles()
    showToast({ type: 'success', message: `已定位 ${hit.customer?.name ?? ''} · ${plate}` })
  } catch (err: any) {
    // 已由拦截器提示
  } finally {
    scanning.value = false
  }
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
const onFileChange = async (e: Event) => {
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
    // 上传前压缩：长边 1600px / JPEG 0.8，EXIF 转正；失败自动回退原文件
    const compressed = await compressImage(file)
    // 添加到列表并上传
    const reader = new FileReader()
    reader.onload = (ev) => {
      const photoItem = {
        content: ev.target?.result as string,
        url: '',
        status: 'uploading',
        file: compressed
      }
      photos.value.push(photoItem)
      uploadPhoto(photoItem)
    }
    reader.readAsDataURL(compressed)
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

// 删除照片：已上传成功的同步删除服务器文件，避免孤儿文件堆积
const deletePhoto = async (idx: number) => {
  const photoItem = photos.value[idx]
  if (!photoItem) return
  try {
    await showConfirmDialog({
      title: '删除照片',
      message: '确定删除这张照片吗？'
    })
    if (photoItem.status === 'done' && photoItem.url) {
      await deleteUpload(photoItem.url).catch(() => {
        // 服务器清理失败不阻塞本地移除（提交前仍可重试）
      })
    }
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
    clearDraft(DRAFT_KEY)
    setTimeout(() => {
      router.push(`/orders/${(order as any).id}`)
    }, 800)
  } catch (e) {
    // 已拦截
  }
}

// ===== 表单草稿兜底 =====
// 输入变化即存（仅文本字段，照片即时上传不适用），建单成功后清除
let draftTimer: ReturnType<typeof setTimeout> | null = null
watch(form, () => {
  if (draftTimer) clearTimeout(draftTimer)
  draftTimer = setTimeout(() => saveDraft(DRAFT_KEY, { ...form }), 400)
})

// 重进页面时询问是否恢复未提交的草稿
const tryRestoreDraft = async () => {
  const d = loadDraft<typeof form>(DRAFT_KEY)
  if (!draftHasContent(d)) return
  try {
    await showConfirmDialog({
      title: '恢复草稿',
      message: '检测到未提交的接车内容，是否恢复？'
    })
    Object.assign(form, d)
  } catch (e) { /* 用户放弃恢复，保留草稿不动 */ }
}

onMounted(() => {
  loadCustomers()
  tryRestoreDraft()
})
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
/* 诉求快捷标签 */
.complaint-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.complaint-tag {
  font-size: 12px;
  color: var(--ink-subtle);
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: 999px;
  padding: 2px 10px;
  cursor: pointer;
  user-select: none;
}
.complaint-tag.active {
  color: #fff;
  background: var(--primary);
  border-color: var(--primary);
}
.complaint-tag:active {
  background: var(--surface-3);
}
/* 扫描入口（扫行驶证/拍车牌） */
.scan-entry {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--primary-hover);
  border: 1px dashed var(--primary);
  border-radius: 999px;
  padding: 3px 12px;
  margin-bottom: 10px;
  cursor: pointer;
  user-select: none;
}
.scan-entry:active {
  background: var(--surface-2);
}
/* 最近到店快捷区 */
.recent-section {
  padding: 8px 4px 12px;
  border-bottom: 1px solid var(--hairline);
  margin-bottom: 8px;
}
.recent-title {
  font-size: 12px;
  color: var(--ink-subtle);
  margin-bottom: 6px;
}
.recent-list {
  display: flex;
  gap: 8px;
}
.recent-item {
  flex: 1;
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: 8px;
  padding: 8px 10px;
  cursor: pointer;
}
.recent-item:active {
  background: var(--surface-3);
}
.recent-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--ink);
}
.recent-meta {
  font-size: 11px;
  color: var(--ink-subtle);
  margin-top: 2px;
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
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-2);
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
  background: rgba(0,0,0,0.6);
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
  background: rgba(242,86,106,0.75);
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
  background: rgba(0,0,0,0.6);
  border-radius: 50%;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  cursor: pointer;
  z-index: 2;
}
/* 添加按钮：表面1底色 + 发丝线虚线框 */
.photo-add {
  width: calc((100% - 24px) / 4);
  aspect-ratio: 1;
  border: 1px dashed var(--hairline-strong);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  background: var(--surface-1);
}
.photo-add:active {
  background: var(--surface-2);
}
.photo-add :deep(.van-icon) {
  color: var(--ink-tertiary);
}
.photo-add-text {
  font-size: 11px;
  color: var(--ink-subtle);
}
</style>
