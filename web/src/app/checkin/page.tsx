'use client'

// 接车登记：客户/车辆选择与新建、扫行驶证 OCR 建档、拍车牌找车、车牌键盘、
// 9 张照片 Blob 直传（压缩/重试/删远端）、诉求快捷标签、草稿兜底（自旧 Checkin.vue 移植）
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ScanLine, Camera, X, TriangleAlert, ImagePlus, Search } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import ImagePreview from '@/components/mobile/ImagePreview'
import PlateKeyboard from '@/components/PlateKeyboard'
import { useConfirm } from '@/components/mobile/ConfirmProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import {
  getCustomers, createCustomer, getVehicles, createVehicle,
  createCheckin, uploadImage, deleteUpload, ocrVehicleLicense, ocrPlate
} from '@/lib/api'
import type { Customer, Vehicle } from '@/lib/types'
import { compressImage } from '@/lib/image'
import { isValidPlate } from '@/lib/plate'
import { saveDraft, loadDraft, clearDraft, draftHasContent } from '@/lib/draft'

// 接车表单草稿键
const DRAFT_KEY = 'checkin'

// 常见诉求标签：点选追加，覆盖高频口述场景
const COMPLAINT_TAGS = ['异响', '抖动', '故障灯亮', '保养到期', '漏油', '空调不制冷', '刹车异常', '启动困难']

// 行驶证品牌型号解析："大众牌FV7160AAWG" → 品牌=大众 / 型号=FV7160AAWG
function parseBrandModel(s: string | null): { brand: string; model: string } {
  if (!s) return { brand: '', model: '' }
  const m = s.match(/^([\u4e00-\u9fa5]+)牌/)
  const brand = m ? m[1] : ''
  const model = s.replace(/^([\u4e00-\u9fa5]+)牌?/, '')
  return { brand, model }
}

// 照片列表项：content(本地预览)、url(Blob 地址)、status、file(待传文件)
interface PhotoItem {
  content: string
  url: string
  status: 'uploading' | 'done' | 'failed'
  file: File
}

export default function CheckinPage() {
  const router = useRouter()
  const confirm = useConfirm()

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [customerList, setCustomerList] = useState<Customer[]>([])
  const [vehicleList, setVehicleList] = useState<Vehicle[]>([])
  const [customerKeyword, setCustomerKeyword] = useState('')
  const [photos, setPhotos] = useState<PhotoItem[]>([])

  const [showCustomerPicker, setShowCustomerPicker] = useState(false)
  const [showVehiclePicker, setShowVehiclePicker] = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [showNewVehicle, setShowNewVehicle] = useState(false)
  const [showPlateKeyboard, setShowPlateKeyboard] = useState(false)

  const [form, setForm] = useState({ complaint: '', mileage: '', vehicleCondition: '' })
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', address: '' })
  const [newVehicle, setNewVehicle] = useState({ plateNumber: '', brand: '', model: '', vin: '' })

  // 隐藏文件输入：相册多选 / 行驶证拍照 / 车牌拍照（capture 拉起相机，兼容微信内浏览器）
  const fileInputRef = useRef<HTMLInputElement>(null)
  const licenseInputRef = useRef<HTMLInputElement>(null)
  const plateInputRef = useRef<HTMLInputElement>(null)
  const scanningRef = useRef(false)

  // 照片预览
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewImages, setPreviewImages] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)

  // 提交中状态：按钮转 loading，防弱网下双击重复建单
  const [submitting, setSubmitting] = useState(false)

  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers({ keyword: customerKeyword })
      setCustomerList(data)
    } catch { /* 静默 */ }
  }, [customerKeyword])

  const loadVehicles = useCallback(async () => {
    if (!selectedCustomer) return
    try {
      const data = await getVehicles({ customerId: selectedCustomer.id })
      setVehicleList(data)
    } catch { /* 静默 */ }
  }, [selectedCustomer])

  const selectCustomer = async (c: Customer) => {
    setSelectedCustomer(c)
    setSelectedVehicle(null)
    setShowCustomerPicker(false)
    try {
      const list = await getVehicles({ customerId: c.id })
      setVehicleList(list)
      // 名下只有一辆车时自动选中，省去第二层选择弹窗
      if (list.length === 1) {
        setSelectedVehicle(list[0])
        toast.success(`已选择 ${c.name} · ${list[0].plateNumber}`)
      }
    } catch { /* 静默 */ }
  }

  const selectVehicle = (v: Vehicle) => {
    setSelectedVehicle(v)
    setShowVehiclePicker(false)
  }

  const submitNewCustomer = async () => {
    if (!newCustomer.name) return toast('请输入姓名')
    if (!newCustomer.phone) return toast('请输入电话')
    try {
      const c = await createCustomer(newCustomer)
      setSelectedCustomer(c)
      setShowNewCustomer(false)
      setNewCustomer({ name: '', phone: '', address: '' })
      void loadCustomers()
      void loadVehicles()
      // 扫行驶证建档流程：客户保存后车辆表单已预填，直接带出建车弹窗
      if (newVehicle.plateNumber) setShowNewVehicle(true)
    } catch { /* 已拦截 */ }
  }

  const submitNewVehicle = async () => {
    if (!selectedCustomer) return toast('请先选择客户')
    const plate = newVehicle.plateNumber.trim().toUpperCase()
    if (!plate) return toast('请输入车牌号')
    if (!isValidPlate(plate)) return toast('车牌格式不正确（普通牌7位，新能源8位）')
    try {
      const v = await createVehicle({ ...newVehicle, plateNumber: plate, customerId: selectedCustomer.id })
      setSelectedVehicle(v)
      setShowNewVehicle(false)
      setNewVehicle({ plateNumber: '', brand: '', model: '', vin: '' })
      void loadVehicles()
    } catch { /* 已拦截 */ }
  }

  // ===== OCR 扫描（后端代理百度，未配密钥/识别失败均不阻塞手输） =====

  // 拍行驶证 → 识别 → 预填新建客户/车辆表单（电话需人工补录）
  const onLicenseScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file || scanningRef.current) return
    scanningRef.current = true
    try {
      const compressed = await compressImage(file)
      const res = await ocrVehicleLicense(compressed)
      if (!res.plateNumber && !res.owner) {
        return toast('未能识别出行驶证内容，请正对证件、避免反光后重试')
      }
      // 预填两个表单，客户弹窗先出（补电话），保存后自动衔接建车弹窗
      setNewCustomer({ name: res.owner || '', phone: '', address: res.address || '' })
      setNewVehicle(prev => ({
        ...prev,
        plateNumber: (res.plateNumber || '').toUpperCase(),
        ...parseBrandModel(res.brandModel ?? null),
        vin: res.vin || ''
      }))
      setShowNewCustomer(true)
      toast.success('已识别，请补录客户电话')
    } catch { /* 具体原因已由请求封装 toast，此处保持手输路径 */ } finally {
      scanningRef.current = false
    }
  }

  // 拍车牌 → 全库找车 → 命中则同时选中客户与车辆
  const onPlateScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file || scanningRef.current) return
    scanningRef.current = true
    try {
      const compressed = await compressImage(file)
      const res = await ocrPlate(compressed)
      const plate = String(res.number || '').toUpperCase()
      if (!plate) return toast('未识别到车牌，请重试')
      // 跨客户按车牌找车
      const list = await getVehicles({ keyword: plate })
      const hit = list.find(v => (v.plateNumber || '').toUpperCase() === plate)
      if (!hit) {
        toast(`车牌 ${plate} 未建档，可用「扫行驶证建档」`)
        return
      }
      setSelectedCustomer(hit.customer ?? null)
      setSelectedVehicle(hit)
      setShowVehiclePicker(false)
      void loadVehicles()
      toast.success(`已定位 ${hit.customer?.name ?? ''} · ${plate}`)
    } catch { /* 已由请求封装提示 */ } finally {
      scanningRef.current = false
    }
  }

  // ===== 照片上传（Blob 客户端直传） =====

  // 上传单张照片（按数组下标更新状态）
  const uploadPhoto = async (idx: number, file: File) => {
    try {
      const res = await uploadImage(file)
      setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, url: res.url, status: 'done' } : p))
    } catch {
      setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, status: 'failed' } : p))
      toast('照片上传失败，点击重试')
    }
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const files = input.files
    if (!files || files.length === 0) return

    const remaining = 9 - photos.length
    const filesToUpload = Array.from(files).slice(0, remaining)

    // 先收集全部待传项，再一次性追加并按起始下标逐张触发上传
    const startIndex = photos.length
    const newItems: PhotoItem[] = []
    for (const file of filesToUpload) {
      // 校验文件类型与大小（10MB）
      if (!file.type.startsWith('image/')) {
        toast('只能上传图片文件')
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        toast('图片大小不能超过10MB')
        continue
      }
      // 上传前压缩：长边 1600px / JPEG 0.8，EXIF 转正；失败自动回退原文件
      const compressed = await compressImage(file)
      const content = await new Promise<string>(resolve => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(compressed)
      })
      newItems.push({ content, url: '', status: 'uploading', file: compressed })
    }

    if (newItems.length > 0) {
      setPhotos(prev => [...prev, ...newItems])
      newItems.forEach((item, i) => void uploadPhoto(startIndex + i, item.file))
    }

    // 清空 input，允许重复选择同一文件
    input.value = ''
  }

  // 重试上传
  const retryUpload = (idx: number) => {
    const photo = photos[idx]
    if (!photo?.file) return
    setPhotos(prev => prev.map((p, i) => i === idx ? { ...p, status: 'uploading' } : p))
    void uploadPhoto(idx, photo.file)
  }

  // 删除照片：已上传成功的同步删除远端文件，避免孤儿文件堆积
  const deletePhoto = async (idx: number) => {
    const photo = photos[idx]
    if (!photo) return
    if (!(await confirm({ title: '删除照片', message: '确定删除这张照片吗？' }))) return
    if (photo.status === 'done' && photo.url) {
      // 远端清理失败不阻塞本地移除（提交前仍可重试）
      await deleteUpload(photo.url).catch(() => {})
    }
    setPhotos(prev => prev.filter((_, i) => i !== idx))
  }

  // 预览照片（仅已上传完成的照片可预览）
  const previewPhoto = (idx: number) => {
    const donePhotos = photos.filter(p => p.status === 'done' && p.url).map(p => p.url)
    if (donePhotos.length === 0) return
    // 计算在已完成照片中的索引
    const doneIdx = photos.slice(0, idx + 1).filter(p => p.status === 'done' && p.url).length - 1
    setPreviewImages(donePhotos)
    setPreviewIndex(Math.max(0, doneIdx))
    setPreviewOpen(true)
  }

  // 追加诉求标签：已包含则忽略，多个标签用顿号连接
  const appendComplaint = (tag: string) => {
    setForm(f => {
      if (f.complaint.includes(tag)) return f
      return { ...f, complaint: f.complaint ? `${f.complaint}、${tag}` : tag }
    })
  }

  const submit = async () => {
    if (submitting) return
    if (!selectedCustomer) return toast('请选择客户')
    if (!selectedVehicle) return toast('请选择车辆')
    if (!form.complaint) return toast('请输入客户诉求')

    // 检查是否有上传中的照片
    if (photos.some(p => p.status === 'uploading')) return toast('照片正在上传中，请稍候')

    // 检查是否有上传失败的照片
    const failed = photos.filter(p => p.status === 'failed')
    if (failed.length > 0) {
      const go = await confirm({
        title: '上传失败',
        message: `有${failed.length}张照片上传失败，是否忽略并继续？`
      })
      if (!go) return
    }

    setSubmitting(true)
    try {
      // 只收集上传成功的照片 URL
      const photoPaths = photos.filter(p => p.status === 'done' && p.url).map(p => p.url)

      const order = await createCheckin({
        customerId: selectedCustomer.id,
        vehicleId: selectedVehicle.id,
        complaint: form.complaint,
        mileageIn: form.mileage ? Number(form.mileage) : null,
        vehicleCondition: form.vehicleCondition,
        photos: photoPaths
      })

      toast.success('工单创建成功')
      clearDraft(DRAFT_KEY)
      // 重置本地表单，防止返回到本页时残留已提交的数据造成重复建单
      setSelectedCustomer(null)
      setSelectedVehicle(null)
      setPhotos([])
      setForm({ complaint: '', mileage: '', vehicleCondition: '' })
      // replace 替换历史记录：返回键回到上一页（工作台）而非已提交的表单
      router.replace(`/orders/${order.id}`)
    } catch { /* 已拦截 */ } finally {
      setSubmitting(false)
    }
  }

  // ===== 表单草稿兜底：输入变化即存（400ms 防抖），建单成功后清除 =====
  useEffect(() => {
    const t = setTimeout(() => {
      // 空表单不落草稿：避免进页面即写入空草稿，下次进入弹无意义的恢复确认框
      if (!draftHasContent({ ...form })) return
      saveDraft(DRAFT_KEY, { ...form })
    }, 400)
    return () => clearTimeout(t)
  }, [form])

  // 首次进入：拉客户列表 + 询问是否恢复未提交的草稿
  useEffect(() => {
    void loadCustomers()
    ;(async () => {
      const d = loadDraft<typeof form>(DRAFT_KEY)
      if (!draftHasContent(d)) return
      if (await confirm({ title: '恢复草稿', message: '检测到未提交的接车内容，是否恢复？' })) {
        setForm(d!)
      } // 用户放弃恢复时保留草稿不动
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 最近到店快捷区：取排序后的前三个有到店记录的客户
  const recentCustomers = customerList.filter(c => c.lastVisitAt).slice(0, 3)

  return (
    <div className="page-container">
      <NavBar title="接车登记" />

      <div className="page-content">
        {/* 客户选择 */}
        <div className="card">
          <div className="section-title">客户信息</div>
          {/* 扫行驶证一次建档：识别所有人/车牌/品牌型号/VIN，电话需人工补录 */}
          <button
            type="button"
            className="pressable mb-2.5 inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[12px]"
            style={{ color: 'var(--primary-hover)', border: '1px dashed var(--primary)' }}
            onClick={() => licenseInputRef.current?.click()}
          >
            <ScanLine size={16} />
            <span>扫行驶证建档</span>
          </button>
          {selectedCustomer ? (
            <Cell title={selectedCustomer.name} label={selectedCustomer.phone} onClick={() => setShowCustomerPicker(true)} />
          ) : (
            <Cell title="选择客户" right={<span>请选择</span>} onClick={() => setShowCustomerPicker(true)} />
          )}
          <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowNewCustomer(true)}>
            + 新建客户
          </Button>
        </div>

        {/* 车辆选择 */}
        {selectedCustomer && (
          <div className="card">
            <div className="section-title">车辆信息</div>
            {selectedVehicle ? (
              <Cell
                title={selectedVehicle.plateNumber}
                label={`${selectedVehicle.brand || ''} ${selectedVehicle.model || ''}`}
                onClick={() => setShowVehiclePicker(true)}
              />
            ) : (
              <Cell title="选择车辆" right={<span>请选择</span>} onClick={() => setShowVehiclePicker(true)} />
            )}
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setShowNewVehicle(true)}>
              + 新建车辆
            </Button>
          </div>
        )}

        {/* 接车信息 */}
        <div className="card">
          <div className="section-title">接车信息</div>
          {/* 常用诉求标签：点击追加，减少手打 */}
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {COMPLAINT_TAGS.map(t => {
              const active = form.complaint.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  className="pressable rounded-full border px-2.5 py-0.5 text-[12px]"
                  style={active
                    ? { color: '#fff', background: 'var(--primary)', borderColor: 'var(--primary)' }
                    : { color: 'var(--ink-subtle)', background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}
                  onClick={() => appendComplaint(t)}
                >
                  {t}
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-3">
            <Field label="客户诉求">
              <Textarea rows={2} value={form.complaint} placeholder="描述故障或需求"
                onChange={e => setForm(f => ({ ...f, complaint: e.target.value }))} />
            </Field>
            <Field label="当前里程">
              <Input inputMode="numeric" value={form.mileage} placeholder="公里数"
                onChange={e => setForm(f => ({ ...f, mileage: e.target.value }))} />
            </Field>
            <Field label="车况描述">
              <Textarea rows={2} value={form.vehicleCondition} placeholder="可选"
                onChange={e => setForm(f => ({ ...f, vehicleCondition: e.target.value }))} />
            </Field>
          </div>
        </div>

        {/* 接车照片 */}
        <div className="card">
          <div className="flex-between mb-3">
            <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>接车照片</span>
            <span className="text-muted">{photos.length}/9 张</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative aspect-square overflow-hidden rounded-lg" style={{ width: 'calc((100% - 24px) / 4)', background: 'var(--surface-2)' }}>
                {photo.status !== 'failed' && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.content || photo.url}
                    alt=""
                    className="pressable h-full w-full cursor-pointer object-cover"
                    onClick={() => previewPhoto(idx)}
                  />
                )}
                {/* 上传中遮罩 */}
                {photo.status === 'uploading' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(0,0,0,0.6)' }}>
                    <Loader2 size={24} className="animate-spin" color="#fff" />
                    <span className="text-[11px] text-white">上传中</span>
                  </div>
                )}
                {/* 上传失败遮罩（含重试入口） */}
                {photo.status === 'failed' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(242,86,106,0.75)' }}>
                    <TriangleAlert size={24} color="#fff" />
                    <span className="text-[11px] text-white">上传失败</span>
                    <button type="button" className="text-[12px] text-white underline" onClick={() => retryUpload(idx)}>重试</button>
                  </div>
                )}
                {/* 删除按钮 */}
                {photo.status !== 'uploading' && (
                  <button
                    type="button"
                    aria-label="删除照片"
                    className="absolute right-0.5 top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full"
                    style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}
                    onClick={() => deletePhoto(idx)}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            ))}
            {/* 添加按钮：表面1底色 + 发丝线虚线框 */}
            {photos.length < 9 && (
              <button
                type="button"
                className="pressable flex aspect-square flex-col items-center justify-center gap-1 rounded-lg"
                style={{ width: 'calc((100% - 24px) / 4)', border: '1px dashed var(--hairline-strong)', background: 'var(--surface-1)' }}
                onClick={() => {
                  if (photos.length >= 9) return toast('最多上传9张照片')
                  fileInputRef.current?.click()
                }}
              >
                <ImagePlus size={28} style={{ color: 'var(--ink-tertiary)' }} />
                <span className="text-[11px]" style={{ color: 'var(--ink-subtle)' }}>拍照/相册</span>
              </button>
            )}
          </div>
          {/* 隐藏的文件输入（相册多选） */}
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileChange} />
          {/* 图片预览 */}
          {previewOpen && (
            <ImagePreview
              images={previewImages}
              index={previewIndex}
              onClose={() => setPreviewOpen(false)}
            />
          )}
        </div>

        {/* 提交 */}
        <Button className="h-10 w-full" disabled={submitting} onClick={submit}>
          {submitting && <Loader2 className="animate-spin" />}
          创建工单
        </Button>
      </div>

      {/* 客户选择弹窗 */}
      <BottomSheet open={showCustomerPicker} onOpenChange={setShowCustomerPicker} title="选择客户">
        <div className="flex items-center gap-2 pb-2">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-tertiary)' }} />
            <Input
              value={customerKeyword}
              placeholder="搜索姓名/电话"
              className="h-9 rounded-lg pl-8"
              style={{ background: 'var(--surface-2)' }}
              onChange={e => setCustomerKeyword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') void loadCustomers() }}
            />
          </div>
          <button type="button" className="pressable shrink-0 text-[14px]" style={{ color: 'var(--primary-hover)' }} onClick={loadCustomers}>
            搜索
          </button>
        </div>
        {/* 最近到店快捷区：点一下同时选客户（单车自动带出车辆） */}
        {recentCustomers.length > 0 && (
          <div className="mb-2 border-b pb-3" style={{ borderColor: 'var(--hairline)' }}>
            <div className="mb-1.5 text-[12px]" style={{ color: 'var(--ink-subtle)' }}>最近到店</div>
            <div className="flex gap-2">
              {recentCustomers.map(c => (
                <button
                  key={c.id}
                  type="button"
                  className="pressable flex-1 rounded-lg border px-2.5 py-2 text-left"
                  style={{ background: 'var(--surface-2)', borderColor: 'var(--hairline)' }}
                  onClick={() => selectCustomer(c)}
                >
                  <div className="text-[14px] font-medium" style={{ color: 'var(--ink)' }}>{c.name}</div>
                  <div className="mt-0.5 text-[11px]" style={{ color: 'var(--ink-subtle)' }}>
                    {c._count?.vehicles || 0}辆车 · {c.phone}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        {customerList.map(c => (
          <Cell key={c.id} title={c.name} label={c.phone} onClick={() => selectCustomer(c)} />
        ))}
        {customerList.length === 0 && <Empty description="暂无客户" />}
      </BottomSheet>

      {/* 车辆选择弹窗 */}
      <BottomSheet open={showVehiclePicker} onOpenChange={setShowVehiclePicker} title="选择车辆">
        {/* 拍车牌快速定位已建档车辆（跨客户） */}
        <button
          type="button"
          className="pressable mb-2.5 inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[12px]"
          style={{ color: 'var(--primary-hover)', border: '1px dashed var(--primary)' }}
          onClick={() => plateInputRef.current?.click()}
        >
          <Camera size={16} />
          <span>拍车牌找车</span>
        </button>
        {vehicleList.map(v => (
          <Cell
            key={v.id}
            title={v.plateNumber}
            label={`${v.brand || ''} ${v.model || ''}`}
            onClick={() => selectVehicle(v)}
          />
        ))}
        {vehicleList.length === 0 && <Empty description="暂无车辆" />}
      </BottomSheet>

      {/* 新建客户弹窗 */}
      <BottomSheet open={showNewCustomer} onOpenChange={setShowNewCustomer} title="新建客户">
        <div className="flex flex-col gap-3">
          <Field label="姓名">
            <Input value={newCustomer.name} placeholder="请输入姓名"
              onChange={e => setNewCustomer(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="电话">
            <Input type="tel" value={newCustomer.phone} placeholder="请输入电话"
              onChange={e => setNewCustomer(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="住址">
            <Input value={newCustomer.address} placeholder="可选，行驶证可识别"
              onChange={e => setNewCustomer(f => ({ ...f, address: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" onClick={submitNewCustomer}>保存</Button>
        </div>
      </BottomSheet>

      {/* 新建车辆弹窗 */}
      <BottomSheet open={showNewVehicle} onOpenChange={setShowNewVehicle} title="新建车辆">
        <div className="flex flex-col gap-3">
          {/* 车牌走专用键盘，避免系统中英文切换与小写脏数据 */}
          <Field label="车牌号">
            <Input
              value={newVehicle.plateNumber}
              placeholder="点击输入车牌"
              readOnly
              className="cursor-pointer"
              onClick={() => setShowPlateKeyboard(true)}
              onFocus={() => setShowPlateKeyboard(true)}
            />
          </Field>
          <Field label="品牌">
            <Input value={newVehicle.brand} placeholder="如丰田"
              onChange={e => setNewVehicle(f => ({ ...f, brand: e.target.value }))} />
          </Field>
          <Field label="车型">
            <Input value={newVehicle.model} placeholder="如卡罗拉"
              onChange={e => setNewVehicle(f => ({ ...f, model: e.target.value }))} />
          </Field>
          <Field label="VIN">
            <Input value={newVehicle.vin} placeholder="选填，行驶证可识别"
              onChange={e => setNewVehicle(f => ({ ...f, vin: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" onClick={submitNewVehicle}>保存</Button>
        </div>
      </BottomSheet>

      {/* 车牌专用键盘 */}
      <PlateKeyboard
        open={showPlateKeyboard}
        onOpenChange={setShowPlateKeyboard}
        value={newVehicle.plateNumber}
        onChange={v => setNewVehicle(f => ({ ...f, plateNumber: v }))}
      />

      {/* 扫证件/车牌的隐藏拍照入口 */}
      <input ref={licenseInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onLicenseScan} />
      <input ref={plateInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPlateScan} />
    </div>
  )
}
