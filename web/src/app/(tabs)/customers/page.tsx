'use client'

// 客户列表：搜索 + 新增客户弹窗（自旧 Customers.vue 移植）
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'motion/react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'
import { getCustomers, createCustomer } from '@/lib/api'
import type { Customer } from '@/lib/types'

export default function CustomersPage() {
  const router = useRouter()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', remark: '' })
  // 保存中状态：防弱网双击重复建档
  const [adding, setAdding] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getCustomers({ keyword })
      setCustomers(data)
    } catch { /* 静默 */ } finally {
      setLoading(false)
    }
  }, [keyword])

  useEffect(() => { void loadData() }, [loadData])

  const submitAdd = async () => {
    if (adding) return
    if (!form.name) return toast('请输入姓名')
    if (!form.phone) return toast('请输入电话')
    setAdding(true)
    try {
      await createCustomer(form)
      toast.success('添加成功')
      setShowAdd(false)
      setForm({ name: '', phone: '', remark: '' })
      void loadData()
    } catch { /* 已拦截 */ } finally {
      setAdding(false)
    }
  }

  return (
    <div className="page-container page-frame">
      <NavBar
        title="客户"
        back={false}
        right={
          <button type="button" aria-label="新增客户" className="pressable" onClick={() => setShowAdd(true)}>
            <Plus size={20} />
          </button>
        }
      />

      {/* 搜索框 */}
      <div className="flex items-center px-3 py-2">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--ink-tertiary)' }} />
          <Input
            value={keyword}
            placeholder="搜索姓名/电话"
            className="h-9 rounded-lg pl-8"
            style={{ background: 'var(--surface-2)' }}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadData() }}
          />
        </div>
      </div>

      <div className="page-content scroll-area">
        {/* 首次加载骨架：与客户行信息结构对应 */}
        {loading && customers.length === 0 &&
          Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="border-b py-[13px]" style={{ borderColor: 'var(--hairline)' }}>
              <div className="flex-between">
                <div className="flex-1">
                  <div className="sk sk-line" style={{ width: '26%' }} />
                  <div className="sk sk-sm" style={{ width: '40%', marginTop: 8 }} />
                </div>
                <div className="sk sk-sm" style={{ width: 42 }} />
              </div>
            </div>
          ))}

        <AnimatePresence initial={false}>
          {customers.map((c, idx) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', bounce: 0, duration: 0.35, delay: Math.min(idx * 0.03, 0.24) }}
            >
              <Cell
                title={c.name}
                label={c.phone}
                right={<span>{c._count?.vehicles || 0}辆车</span>}
                onClick={() => router.push(`/customers/${c.id}`)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {customers.length === 0 && !loading && <Empty description="暂无客户" />}
      </div>

      {/* 新增客户弹窗 */}
      <BottomSheet open={showAdd} onOpenChange={setShowAdd} title="新增客户">
        <div className="flex flex-col gap-3">
          <Field label="姓名">
            <Input value={form.name} placeholder="请输入姓名" onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="电话">
            <Input type="tel" value={form.phone} placeholder="请输入电话" onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </Field>
          <Field label="备注">
            <Textarea rows={2} value={form.remark} placeholder="可选" onChange={e => setForm(f => ({ ...f, remark: e.target.value }))} />
          </Field>
          <Button className="mt-2 h-10" disabled={adding} onClick={submitAdd}>保存</Button>
        </div>
      </BottomSheet>
    </div>
  )
}
