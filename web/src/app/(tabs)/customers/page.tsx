'use client'

// 客户列表：搜索 + 新增客户弹窗（自旧 Customers.vue 移植）
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Search } from 'lucide-react'
import NavBar from '@/components/mobile/NavBar'
import Cell from '@/components/mobile/Cell'
import Empty from '@/components/mobile/Empty'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { getCustomers, createCustomer } from '@/lib/api'
import { useListView } from '@/lib/useListView'
import { formatDateTime } from '@/lib/format'

export default function CustomersPage() {
  const router = useRouter()

  const [keyword, setKeyword] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', phone: '', remark: '' })
  // 保存中状态：防弱网双击重复建档
  const [adding, setAdding] = useState(false)

  const read = useCallback(() => getCustomers({ keyword }), [keyword])
  const { rows: customers, phase, refresh: loadData } = useListView(read)
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

  const empty = phase === 'ready' && customers.length === 0
  const addCustomer = (
    <Button className="list-create" onClick={() => setShowAdd(true)}><Plus size={16} />新增客户</Button>
  )

  return (
    <div className="page-container page-frame">
      <NavBar
        title="客户"
        back={false}
        right={(!empty || keyword) && addCustomer}
      />

      {/* 搜索框 */}
      <div className="orders-toolbar">
        <div className="orders-search">
          <Search size={17} strokeWidth={1.7} />
          <Input
            value={keyword}
            placeholder="搜索姓名/电话"
            aria-label="搜索姓名/电话"
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadData() }}
          />
        </div>
      </div>

      <div className="page-content scroll-area">
        {/* 首次加载骨架：与客户行信息结构对应 */}
        {phase === 'loading' && customers.length === 0 &&
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

        {/* 连续列表保持稳定位置，不为每行重复播放进场动画 */}
        {customers.map(c => (
          <Cell
            key={c.id}
            className="customer-row"
            title={c.name}
            label={<>
              <span className="customer-contact">
                {c.phone}
                {!!c.vehicles?.length && <span>{c.vehicles.map(v => v.plateNumber).join(' · ')}</span>}
              </span>
              {c.lastVisitAt && <span className="block">最近到店 <time>{formatDateTime(c.lastVisitAt)}</time></span>}
            </>}
            right={(c._count?.vehicles || 0) > 0 ? <span>{c._count?.vehicles}辆车</span> : null}
            onClick={() => router.push(`/customers/${c.id}`)}
          />
        ))}

        {empty && (keyword ? (
          <Empty page description="没有匹配的客户"><button className="inline-action" onClick={() => setKeyword('')}>清除搜索</button></Empty>
        ) : <Empty page description="还没有客户档案">{addCustomer}</Empty>)}
        {phase === 'error' && !customers.length && (
          <Empty page description="客户加载失败"><button className="inline-action" onClick={loadData}>重试</button></Empty>
        )}
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
