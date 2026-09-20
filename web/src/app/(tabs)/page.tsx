'use client'

// 工作台：快捷入口 + 今日概览 + 挂账/营收 + 待办提醒（自旧 Home.vue 移植）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'motion/react'
import { toast } from 'sonner'
import dayjs from 'dayjs'
import { Settings, Plus, ChartLine, ClipboardList, ListChecks, Receipt, CircleCheck } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import InstallGuide from '@/components/InstallGuide'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/mobile/ConfirmProvider'
import { getDashboard, getReminders, logout, changePassword } from '@/lib/api'
import { fenToYuan } from '@/lib/money'
import { useAnimatedYuan } from '@/lib/hooks'
import { getReminderTypeLabel, formatMonthDay } from '@/lib/format'
import { hapticFeedback } from '@/lib/feedback'

// 级联进场弹簧：临界阻尼 + 按卡片序错开的延迟
const springIn = (delay: number) => ({ type: 'spring' as const, bounce: 0, duration: 0.4, delay })

interface DashboardStats {
  pendingInspection: number
  repairing: number
  pendingSettlement: number
  completed: number
  monthlyRevenue: number
  unpaidAmount: number
}

export default function HomePage() {
  const router = useRouter()
  const confirm = useConfirm()

  const [stats, setStats] = useState<DashboardStats>({
    pendingInspection: 0, repairing: 0, pendingSettlement: 0, completed: 0, monthlyRevenue: 0, unpaidAmount: 0
  })
  const [pendingReminders, setPendingReminders] = useState<any[]>([])
  // 首次加载中状态，驱动概览/营收骨架
  const [loading, setLoading] = useState(true)

  // 本月营收数字滚动展示（分值驱动）
  const monthlyRevenueDisplay = useAnimatedYuan(stats.monthlyRevenue)

  const loadData = async () => {
    setLoading(true)
    try {
      const [dash, reminders] = await Promise.all([
        getDashboard(),
        getReminders({ status: 'pending' })
      ])
      setStats(dash)
      setPendingReminders((reminders as any[]).slice(0, 5))
    } catch { /* 后端未就绪时静默 */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void loadData() }, [])

  // 概览数字直达对应状态工单列表
  const goOrders = (status: string) => router.push(`/orders?status=${status}`)

  // ===== 访问控制入口：修改密码 / 退出登录 =====
  const [showSettings, setShowSettings] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdForm, setPwdForm] = useState({ old: '', next: '', confirm: '' })

  const openChangePwd = () => {
    setShowSettings(false)
    setPwdForm({ old: '', next: '', confirm: '' })
    setShowChangePwd(true)
  }

  const quitLogout = async () => {
    setShowSettings(false)
    if (await confirm({ title: '退出登录', message: '确定退出当前会话？' })) {
      await logout()
      router.replace('/login')
    }
  }

  const submitChangePwd = async () => {
    if (changingPwd) return
    if (!pwdForm.old) return toast('请输入原密码')
    if (pwdForm.next.length < 6) return toast('新密码至少 6 位')
    if (pwdForm.next !== pwdForm.confirm) return toast('两次输入的新密码不一致')
    setChangingPwd(true)
    try {
      await changePassword({ oldPassword: pwdForm.old, newPassword: pwdForm.next })
      toast.success('密码已更新')
      hapticFeedback()
      setShowChangePwd(false)
    } catch { /* 已拦截 */ } finally {
      setChangingPwd(false)
    }
  }

  const overview = [
    { icon: ClipboardList, label: `待检测 ${stats.pendingInspection}`, status: 'pending_inspection' },
    { icon: ListChecks, label: `维修中 ${stats.repairing}`, status: 'repairing' },
    { icon: Receipt, label: `待结算 ${stats.pendingSettlement}`, status: 'pending_settlement' },
    { icon: CircleCheck, label: `已完成 ${stats.completed}`, status: 'completed' }
  ]

  return (
    <div className="page-container page-frame">
      <NavBar
        title="工作台"
        back={false}
        right={
          <button type="button" aria-label="设置" className="pressable" onClick={() => setShowSettings(true)}>
            <Settings size={20} />
          </button>
        }
      />

      <div className="page-content scroll-area">
        {/* 安装到桌面引导（移动端显示） */}
        <InstallGuide />

        {/* 快捷操作 */}
        <motion.div
          className="mb-3 flex gap-2.5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springIn(0)}
        >
          <motion.div className="flex-1" whileTap={{ scale: 0.96 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} onClick={() => router.push('/checkin')}>
            <Button className="h-10 w-full" tabIndex={-1}>
              <Plus size={16} /> 新建接车
            </Button>
          </motion.div>
          <motion.div className="flex-1" whileTap={{ scale: 0.96 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} onClick={() => router.push('/stats')}>
            <Button variant="outline" className="h-10 w-full" tabIndex={-1}>
              <ChartLine size={16} /> 统计报表
            </Button>
          </motion.div>
        </motion.div>

        {/* 今日概览：点击数字直达对应状态的工单列表 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springIn(0.05)}>
          <div className="card">
            <div className="section-title">今日概览</div>
            {/* 加载骨架：四格占位，数据到达后换成真实宫格 */}
            {loading ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 4 }, (_, i) => <div key={i} className="sk" style={{ height: 44 }} />)}
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {overview.map(o => {
                  const Icon = o.icon
                  return (
                    <button
                      key={o.status}
                      type="button"
                      className="pressable flex flex-col items-center gap-1.5 rounded-lg py-2 active:bg-[var(--surface-2)]"
                      onClick={() => goOrders(o.status)}
                    >
                      <Icon size={22} strokeWidth={1.6} style={{ color: 'var(--primary-hover)' }} />
                      <span className="text-[11px]" style={{ color: 'var(--ink-muted)' }}>{o.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>

        {/* 挂账提醒：点击直达统计页挂账明细 */}
        {stats.unpaidAmount > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springIn(0.1)}>
            <div className="card pressable cursor-pointer active:bg-[var(--surface-2)]" onClick={() => router.push('/stats')}>
              <div className="flex-between">
                <span className="text-danger text-[13px]">挂账未收</span>
                <span className="amount">¥{fenToYuan(stats.unpaidAmount)}</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* 本月营收 */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springIn(0.15)}>
          <div className="card">
            <div className="flex-between">
              <span className="text-[14px] font-semibold" style={{ color: 'var(--ink)' }}>本月营收</span>
              {loading ? (
                <span className="sk" style={{ width: 96, height: 18 }} />
              ) : (
                <span className="amount">¥{monthlyRevenueDisplay}</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* 待办提醒 */}
        {pendingReminders.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={springIn(0.2)}>
            <div className="card">
              <div className="section-title">待办提醒</div>
              {pendingReminders.map(item => (
                <Cell
                  key={item.id}
                  title={item.content || getReminderTypeLabel(item.type)}
                  label={`${item.vehicle?.plateNumber ?? ''} · ${formatMonthDay(item.remindDate)}`}
                  onClick={() => router.push('/reminders')}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* 设置面板：修改密码 / 退出登录 */}
      <BottomSheet open={showSettings} onOpenChange={setShowSettings} title="设置">
        <div className="flex flex-col gap-2">
          <Button variant="outline" className="h-10" onClick={openChangePwd}>修改密码</Button>
          <Button variant="outline" className="h-10" onClick={quitLogout}>退出登录</Button>
        </div>
      </BottomSheet>

      {/* 修改密码弹窗 */}
      <BottomSheet open={showChangePwd} onOpenChange={setShowChangePwd} title="修改密码">
        <div className="flex flex-col gap-3">
          <Field label="原密码">
            <Input type="password" value={pwdForm.old} maxLength={32} placeholder="当前访问密码"
              onChange={e => setPwdForm(f => ({ ...f, old: e.target.value }))} />
          </Field>
          <Field label="新密码">
            <Input type="password" value={pwdForm.next} maxLength={32} placeholder="至少 6 位"
              onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))} />
          </Field>
          <Field label="确认新密码">
            <Input type="password" value={pwdForm.confirm} maxLength={32} placeholder="再次输入新密码"
              onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" disabled={changingPwd} onClick={submitChangePwd}>保存</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
