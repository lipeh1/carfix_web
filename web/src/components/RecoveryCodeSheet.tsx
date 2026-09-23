'use client'

// 恢复码一次性展示弹窗：设置/修改密码、忘记密码重设、手动生成后展示
// 恢复码只在生成时显示这一次，忘记密码时凭它重设访问密码
import BottomSheet from '@/components/mobile/BottomSheet'
import { Button } from '@/components/ui/button'
import { Copy, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'

interface RecoveryCodeSheetProps {
  open: boolean
  /** 8 位原始码（无分隔符），展示时自动格式化为 XXXX-XXXX */
  code: string
  /** 关闭回调（我已保存 / 点击遮罩均触发） */
  onDone: () => void
}

export default function RecoveryCodeSheet({ open, code, onDone }: RecoveryCodeSheetProps) {
  const display = code ? `${code.slice(0, 4)}-${code.slice(4)}` : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(display)
      toast.success('已复制')
    } catch {
      toast('复制失败，请手动抄写')
    }
  }

  return (
    <BottomSheet open={open && !!code} onOpenChange={v => { if (!v) onDone() }} title="找回密码恢复码">
      <div className="flex flex-col gap-3">
        <div
          className="flex items-start gap-2 rounded-lg p-3 text-[12px] leading-relaxed"
          style={{ background: 'var(--surface-2)', color: 'var(--ink-subtle)' }}
        >
          <ShieldAlert size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--danger)' }} />
          <span>
            恢复码只显示这一次，忘记密码时在登录页点「忘记密码」，凭它重设访问密码。
            请截图或抄写妥善保存，丢失后需重新登录生成。
          </span>
        </div>
        <div
          className="select-all rounded-xl py-5 text-center font-mono text-[24px] font-semibold tracking-[3px]"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--hairline)', color: 'var(--ink)' }}
        >
          {display}
        </div>
        <Button variant="outline" className="h-10" onClick={() => void copy()}>
          <Copy size={14} /> 复制恢复码
        </Button>
        <Button className="h-10" onClick={onDone}>我已保存</Button>
      </div>
    </BottomSheet>
  )
}
