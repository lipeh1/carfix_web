'use client'

// 工作台：空闲时引导接车，有待办时展示实际工单、收支和车辆提醒
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings, Plus, ChevronRight } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import InstallGuide from '@/components/InstallGuide'
import RecoveryCodeSheet from '@/components/RecoveryCodeSheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirm } from '@/components/mobile/ConfirmProvider'
import { getDashboard, getOrders, getReminders, logout, changePassword, regenerateRecoveryCode, getShopName, saveShopName } from '@/lib/api'
import { fenToYuan } from '@/lib/money'
import { useAnimatedYuan } from '@/lib/hooks'
import { formatDateTime, formatMonthDay, getOrderStatusLabel, getReminderTypeLabel } from '@/lib/format'
import { hapticFeedback } from '@/lib/feedback'
import { DEFAULT_SHOP_NAME, SHOP_NAME_MAX_LEN, setShopNameCache } from '@/lib/shop'
import type { DashboardStats, Reminder, WorkOrder } from '@/lib/types'

const ORDER_PREVIEW_LIMIT = 5

export default function HomePage() {
  const router = useRouter()
  const confirm = useConfirm()

  const [stats, setStats] = useState<DashboardStats>({
    pendingInspection: 0, repairing: 0, pendingSettlement: 0, completed: 0, monthlyRevenue: 0, unpaidAmount: 0
  })
  const [pendingReminders, setPendingReminders] = useState<Reminder[] | null>(null)
  const [pendingOrders, setPendingOrders] = useState<WorkOrder[] | null>(null)
  const [showAllOrders, setShowAllOrders] = useState(false)
  // 首次加载中状态，驱动概览/营收骨架
  const [loading, setLoading] = useState(true)

  // 本月营收数字滚动展示（分值驱动）
  const monthlyRevenueDisplay = useAnimatedYuan(stats.monthlyRevenue)

  useEffect(() => {
    let current = true
    void Promise.all([getDashboard(), getReminders({ status: 'pending' })]).then(([dash, reminders]) => {
      if (!current) return
      setStats(dash)
      setPendingReminders(reminders.slice(0, 5))
    }).catch(() => { /* 请求错误由接口层提示 */ }).finally(() => {
      if (current) setLoading(false)
    })

    // 工单列表独立加载，保留进厂时间倒序，也包含概览未单列的待报价、待质检等工单。
    void getOrders().then(orders => {
      if (current) setPendingOrders(orders.filter(o => o.status !== 'completed' && o.status !== 'cancelled'))
    }).catch(() => { /* 读取失败时保留未知状态，避免提示门店已经空闲 */ })
    return () => { current = false }
  }, [])

  // 概览数字直达对应状态工单列表
  const goOrders = (status: string) => router.push(`/orders?status=${status}`)

  // ===== 设置入口：店铺名称 / 修改密码 / 恢复码 / 退出登录 =====
  const [showSettings, setShowSettings] = useState(false)
  const [showChangePwd, setShowChangePwd] = useState(false)
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdForm, setPwdForm] = useState({ old: '', next: '', confirm: '' })
  // 一次性恢复码展示（改密/生成后）
  const [recoveryCode, setRecoveryCode] = useState('')
  const [generatingCode, setGeneratingCode] = useState(false)
  // 店铺名称：全局设置存服务端，报价单长图页眉取用
  const [showShopName, setShowShopName] = useState(false)
  const [shopName, setShopName] = useState('')
  const [shopNameLoading, setShopNameLoading] = useState(false)
  const [savingShopName, setSavingShopName] = useState(false)

  // 打开时从服务端拉当前值（未设置为空串，展示走默认名占位）
  const openShopName = async () => {
    setShowSettings(false)
    setShopName('')
    setShopNameLoading(true)
    setShowShopName(true)
    try {
      const res = await getShopName()
      setShopName(res.shopName || '')
    } catch { /* 已拦截，保留空值可重试保存 */ } finally {
      setShopNameLoading(false)
    }
  }

  const submitShopName = async () => {
    if (savingShopName || shopNameLoading) return
    const name = shopName.trim()
    if (name.length > SHOP_NAME_MAX_LEN) return toast(`店名最多 ${SHOP_NAME_MAX_LEN} 字`)
    setSavingShopName(true)
    try {
      await saveShopName(name)
      // 保存成功刷新客户端缓存，报价单长图立即用新名
      setShopNameCache(name)
      hapticFeedback()
      setShowShopName(false)
      toast.success(name ? '店名已更新' : '已恢复默认店名')
    } catch { /* 已拦截 */ } finally {
      setSavingShopName(false)
    }
  }

  const openChangePwd = () => {
    setShowSettings(false)
    setPwdForm({ old: '', next: '', confirm: '' })
    setShowChangePwd(true)
  }

  // 手动生成恢复码：旧的立即作废，需确认
  const genRecoveryCode = async () => {
    if (generatingCode) return
    setShowSettings(false)
    if (!(await confirm({ title: '生成新恢复码', message: '旧的恢复码将立即失效，确定生成？' }))) return
    setGeneratingCode(true)
    try {
      const res = await regenerateRecoveryCode()
      setRecoveryCode(res.recoveryCode)
    } catch { /* 已拦截 */ } finally {
      setGeneratingCode(false)
    }
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
      // 改密成功会换发新恢复码（旧的已作废），必须展示给用户保存
      const res = await changePassword({ oldPassword: pwdForm.old, newPassword: pwdForm.next })
      hapticFeedback()
      setShowChangePwd(false)
      setRecoveryCode(res.recoveryCode)
    } catch { /* 已拦截 */ } finally {
      setChangingPwd(false)
    }
  }

  const overview = [
    { label: '待检测', value: stats.pendingInspection, status: 'pending_inspection' },
    { label: '维修中', value: stats.repairing, status: 'repairing' },
    { label: '待结算', value: stats.pendingSettlement, status: 'pending_settlement' }
  ]
  const activeOverview = overview.filter(o => o.value > 0)
  const isIdle = !loading && pendingOrders?.length === 0 && pendingReminders?.length === 0 &&
    activeOverview.length === 0 && stats.unpaidAmount === 0
  const reportLink = (
    <Button variant="link" asChild><Link href="/stats">统计报表 <ChevronRight size={16} /></Link></Button>
  )
  const isZeroRevenue = !loading && stats.monthlyRevenue === 0
  const showFinancialPanel = stats.unpaidAmount > 0 || !isZeroRevenue
  const revenue = (
    <dl className={`revenue-panel${isZeroRevenue ? ' is-empty' : ''}`}>
      <dt>本月营收</dt>
      <dd className="revenue-value">
        {loading ? <div className="sk" style={{ width: 160, height: 32 }} /> : <>¥{monthlyRevenueDisplay}</>}
      </dd>
    </dl>
  )

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

      <div className="page-content scroll-area dashboard-content">
        <div className={`dashboard-toolbar${isIdle ? ' is-idle' : ''}`}>
          {isIdle && <p className="dashboard-idle-note">暂无待办，来车时可在这里登记</p>}
          <Button asChild><Link href="/checkin"><Plus size={16} /> 新建接车</Link></Button>
          {!isIdle && reportLink}
        </div>

        <div className="dashboard-grid">
          {/* 概览保留可点的状态计数，紧凑排布为下方工单留出空间 */}
          <section className="overview-panel" aria-busy={loading}>
            <div className="dashboard-section-heading">
              <h2 className="section-title">今日概览</h2>
              {isIdle && reportLink}
            </div>
            {loading ? (
              <div className="sk overview-placeholder" />
            ) : (
              <>
                {activeOverview.length > 0 && (
                  <div className="overview-active">
                    {activeOverview.map(o => (
                      <button key={o.status} type="button" className="overview-metric" onClick={() => goOrders(o.status)}>
                        <span>{o.label}</span>
                        <span className="overview-metric-value">{o.value}</span>
                        <ChevronRight size={14} strokeWidth={1.7} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
                <div className="overview-quiet">
                  {overview.filter(o => o.value === 0).map(o => (
                    <button key={o.status} type="button" onClick={() => goOrders(o.status)}>{o.label} <span className="font-mono">0</span></button>
                  ))}
                  <button type="button" onClick={() => goOrders('completed')}>已完成 <span className="font-mono">{stats.completed}</span></button>
                </div>
                {!showFinancialPanel && revenue}
              </>
            )}
          </section>

          {pendingOrders && pendingOrders.length > 0 && (
            <section className="dashboard-orders" aria-labelledby="dashboard-orders-title">
              <h2 id="dashboard-orders-title" className="section-title">待处理工单</h2>
              <ul id="dashboard-order-list">
                {(showAllOrders ? pendingOrders : pendingOrders.slice(0, ORDER_PREVIEW_LIMIT)).map(order => (
                  <li key={order.id}>
                    <Link href={`/orders/${order.id}`} className="dashboard-order-link pressable">
                      <span className="order-plate">{order.vehicle?.plateNumber || order.orderNo}</span>
                      <span className="dashboard-order-status">{getOrderStatusLabel(order.status)}</span>
                      <ChevronRight size={16} strokeWidth={1.7} aria-hidden="true" />
                      <span className="dashboard-order-meta">
                        {(order.vehicle?.brand || order.vehicle?.model) && <span>{order.vehicle.brand} {order.vehicle.model}</span>}
                        <time dateTime={order.createdAt}>进厂 {formatDateTime(order.createdAt)}</time>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {pendingOrders.length > ORDER_PREVIEW_LIMIT && (
                <button type="button" className="dashboard-orders-more" aria-controls="dashboard-order-list"
                  aria-expanded={showAllOrders} onClick={() => setShowAllOrders(shown => !shown)}>
                  {showAllOrders ? '收起' : `展开其余 ${pendingOrders.length - ORDER_PREVIEW_LIMIT} 单`}
                </button>
              )}
            </section>
          )}

          {showFinancialPanel && (
            <div className="dashboard-financial">
              {stats.unpaidAmount > 0 && (
                <button type="button" className="unpaid-panel" onClick={() => router.push('/stats')}>
                  <span>挂账未收</span>
                  <span className="amount">¥{fenToYuan(stats.unpaidAmount)}</span>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
              {revenue}
            </div>
          )}

          {/* 提醒使用连续列表，与数字概要区分层级 */}
          {pendingReminders && pendingReminders.length > 0 && (
            <section className="reminders-panel">
              <div className="section-title">待办提醒</div>
              {pendingReminders.map(item => (
                <Cell
                  key={item.id}
                  className="reminder-work-row"
                  title={<span className="order-plate">{item.vehicle?.plateNumber || getReminderTypeLabel(item.type)}</span>}
                  label={<>{item.content || getReminderTypeLabel(item.type)}{item.vehicle?.model && <span className="block">{item.vehicle.brand} {item.vehicle.model}</span>}</>}
                  right={<span className="font-mono">{formatMonthDay(item.remindDate)}</span>}
                  onClick={() => router.push('/reminders')}
                />
              ))}
            </section>
          )}
        </div>
      </div>
      <InstallGuide />

      {/* 设置面板：店铺名称 / 修改密码 / 恢复码 / 退出登录 */}
      <BottomSheet open={showSettings} onOpenChange={setShowSettings} title="设置">
        <div className="settings-links">
          <Button variant="ghost" className="h-10" onClick={() => void openShopName()}>店铺名称</Button>
          <Button variant="ghost" className="h-10" onClick={openChangePwd}>修改密码</Button>
          <Button variant="ghost" className="h-10" disabled={generatingCode} onClick={() => void genRecoveryCode()}>
            找回密码恢复码
          </Button>
          <Button variant="ghost" className="h-10" onClick={quitLogout}>退出登录</Button>
        </div>
      </BottomSheet>

      {/* 店铺名称弹窗：写入服务端全局设置，报价单长图页眉即时生效 */}
      <BottomSheet open={showShopName} onOpenChange={setShowShopName} title="店铺名称">
        <div className="flex flex-col gap-3">
          <Field label="店名">
            <Input value={shopName} maxLength={SHOP_NAME_MAX_LEN} placeholder={DEFAULT_SHOP_NAME}
              disabled={shopNameLoading}
              onChange={e => setShopName(e.target.value)} />
          </Field>
          <p className="text-[12px]" style={{ color: 'var(--ink-muted)' }}>
            显示在报价单长图页眉，最多 {SHOP_NAME_MAX_LEN} 字；留空则使用默认名称。所有设备共用。
          </p>
          <Button className="mt-2 h-10" disabled={shopNameLoading || savingShopName} onClick={() => void submitShopName()}>保存</Button>
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

      {/* 一次性恢复码展示（改密 / 手动生成后） */}
      <RecoveryCodeSheet open={!!recoveryCode} code={recoveryCode} onDone={() => setRecoveryCode('')} />
    </div>
  )
}
