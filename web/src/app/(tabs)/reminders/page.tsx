'use client'

// 提醒列表：3 状态 tabs + 详情弹窗 + 标记已提醒（自旧 Reminders.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import ScrollTabs from '@/components/mobile/ScrollTabs'
import { Badge } from '@/components/mobile/Badge'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { getReminders, updateReminder } from '@/lib/api'
import { getReminderTypeLabel, formatDate, formatDateTime } from '@/lib/format'

const TABS = [
  { label: '待提醒', value: 'pending' },
  { label: '已提醒', value: 'done' },
  { label: '全部', value: '' }
]

export default function RemindersPage() {
  const [activeTab, setActiveTab] = useState('pending')
  const [reminders, setReminders] = useState<any[]>([])
  // 首次/切 tab 加载中状态，驱动骨架屏
  const [loading, setLoading] = useState(true)
  const [showDetail, setShowDetail] = useState(false)
  const [current, setCurrent] = useState<any>(null)
  // 标记已提醒的补充信息
  const [doneForm, setDoneForm] = useState({ method: 'wechat', feedback: '' })
  // 标记中状态：防弱网双击重复提交
  const [marking, setMarking] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (activeTab) params.status = activeTab
      const data = await getReminders(params)
      setReminders(data as any[])
    } catch { /* 静默 */ } finally {
      setLoading(false)
    }
  }, [activeTab])

  useEffect(() => { void loadData() }, [loadData])

  const openDetail = (item: any) => {
    setCurrent(item)
    // 打开新条目时重置待填项，避免上一条的反馈串到下一条
    setDoneForm({ method: 'wechat', feedback: '' })
    setShowDetail(true)
  }

  const markDone = async () => {
    if (!current || marking) return
    setMarking(true)
    try {
      const payload: Record<string, unknown> = {
        status: 'done',
        remindedAt: new Date().toISOString(),
        remindMethod: doneForm.method
      }
      // 反馈选填，未填写则不更新该字段
      if (doneForm.feedback) payload.feedback = doneForm.feedback
      await updateReminder(current.id, payload)
      toast.success('已标记')
      setShowDetail(false)
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setMarking(false)
    }
  }

  return (
    <div className="page-container page-frame">
      <NavBar title="提醒" back={false} />
      <ScrollTabs tabs={TABS} value={activeTab} onChange={setActiveTab} />

      <div className="page-content scroll-area">
        {/* 首次加载骨架：与提醒行信息结构对应 */}
        {loading &&
          Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="border-b py-[13px]" style={{ borderColor: 'var(--hairline)' }}>
              <div className="flex-between">
                <div className="flex-1">
                  <div className="sk sk-line" style={{ width: '44%' }} />
                  <div className="sk sk-sm" style={{ width: '56%', marginTop: 8 }} />
                </div>
                <div className="sk sk-pill" />
              </div>
            </div>
          ))}

        {!loading && (
          <>
            {reminders.map(item => (
              <Cell
                key={item.id}
                title={item.content || getReminderTypeLabel(item.type)}
                label={`${item.vehicle?.plateNumber ?? ''} · 建议 ${formatDate(item.remindDate)}`}
                right={
                  <Badge tone={item.type === 'maintenance' ? 'warning' : 'primary'}>
                    {getReminderTypeLabel(item.type)}
                  </Badge>
                }
                onClick={() => openDetail(item)}
              />
            ))}
            {reminders.length === 0 && <Empty description="暂无提醒" />}
          </>
        )}
      </div>

      {/* 提醒详情弹窗 */}
      <BottomSheet open={showDetail} onOpenChange={setShowDetail} title={current ? getReminderTypeLabel(current.type) : ''}>
        {current && (
          <div className="flex flex-col gap-2">
            <Cell title="车辆" right={<span style={{ color: 'var(--ink)' }}>{current.vehicle?.plateNumber || '-'}</span>} />
            <Cell title="建议日期" right={<span style={{ color: 'var(--ink)' }}>{formatDate(current.remindDate)}</span>} />
            <Cell title="内容" right={<span style={{ color: 'var(--ink)' }}>{current.content || '-'}</span>} />
            <Cell title="状态" right={<span style={{ color: 'var(--ink)' }}>{current.status === 'done' ? '已提醒' : '待提醒'}</span>} />
            {current.remindedAt && (
              <Cell title="提醒时间" right={<span style={{ color: 'var(--ink)' }}>{formatDateTime(current.remindedAt)}</span>} />
            )}
            {current.feedback && (
              <Cell title="客户反馈" right={<span style={{ color: 'var(--ink)' }}>{current.feedback}</span>} />
            )}

            {/* 标记已提醒需记录方式与客户反馈（DESIGN.md 要求） */}
            {current.status === 'pending' && (
              <div className="mt-3 flex flex-col gap-3">
                <Field label="提醒方式">
                  <RadioGroup
                    value={doneForm.method}
                    onValueChange={v => setDoneForm(f => ({ ...f, method: v }))}
                    className="flex gap-5"
                  >
                    <Label className="flex items-center gap-2 text-[14px] font-normal" style={{ color: 'var(--ink)' }}>
                      <RadioGroupItem value="phone" /> 电话
                    </Label>
                    <Label className="flex items-center gap-2 text-[14px] font-normal" style={{ color: 'var(--ink)' }}>
                      <RadioGroupItem value="wechat" /> 微信
                    </Label>
                  </RadioGroup>
                </Field>
                <Field label="客户反馈">
                  <Textarea
                    rows={2}
                    value={doneForm.feedback}
                    placeholder="可选，记录客户回应"
                    onChange={e => setDoneForm(f => ({ ...f, feedback: e.target.value }))}
                  />
                </Field>
                <Button className="mt-1 h-10" disabled={marking} onClick={markDone}>标记已提醒</Button>
              </div>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}
