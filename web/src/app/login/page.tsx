'use client'

// 访问验证页：首次进入引导设置访问密码，之后凭密码登录（单用户访问控制，见 API auth 路由）
// 设置/重设密码成功后展示一次性恢复码；忘记密码可凭恢复码自助找回
// （自旧 client/src/views/Login.vue 移植）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import BottomSheet from '@/components/mobile/BottomSheet'
import Field from '@/components/mobile/Field'
import RecoveryCodeSheet from '@/components/RecoveryCodeSheet'
import { getAuthStatus, getAuthMe, setupPassword, loginPassword, recoverPassword } from '@/lib/api'
import { hapticFeedback } from '@/lib/feedback'

export default function LoginPage() {
  const router = useRouter()

  // 是否已初始化密码：决定展示「设置」还是「登录」形态
  const [initialized, setInitialized] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  // 找回密码弹窗与一次性恢复码展示
  const [showRecover, setShowRecover] = useState(false)
  const [recovering, setRecovering] = useState(false)
  const [recoverForm, setRecoverForm] = useState({ code: '', next: '', confirm: '' })
  const [recoveryCode, setRecoveryCode] = useState('')

  useEffect(() => {
    ;(async () => {
      try {
        // 已持有有效会话则直接进入系统
        await getAuthMe()
        router.replace('/')
        return
      } catch { /* 未登录，继续 */ }
      try {
        const s = await getAuthStatus()
        setInitialized(!!s.initialized)
      } catch { /* 状态拉取失败按登录形态展示 */ }
    })()
  }, [router])

  const submit = async () => {
    if (loading) return
    // 密码去首尾空格后再提交，杜绝手滑空格导致的「设置时与登录时不一致」
    const pw = password.trim()
    if (!pw) {
      toast('请输入密码')
      return
    }
    setLoading(true)
    try {
      if (!initialized) {
        if (pw.length < 6) {
          toast('密码至少 6 位')
          return
        }
        if (pw !== confirm.trim()) {
          toast('两次输入的密码不一致')
          return
        }
        // 设置成功先展示一次性恢复码，关闭后再进入系统
        const res = await setupPassword({ password: pw })
        setRecoveryCode(res.recoveryCode)
        return
      }
      await loginPassword({ password: pw })
      hapticFeedback()
      router.replace('/')
    } catch {
      // 具体原因已由请求封装 toast（密码错误/频繁锁定等）
    } finally {
      setLoading(false)
    }
  }

  // 恢复码展示完毕（设置/找回两条路径共用）：进入系统
  const recoveryDone = () => {
    setRecoveryCode('')
    hapticFeedback()
    router.replace('/')
  }

  const openRecover = () => {
    setRecoverForm({ code: '', next: '', confirm: '' })
    setShowRecover(true)
  }

  const submitRecover = async () => {
    if (recovering) return
    const code = recoverForm.code.trim()
    const next = recoverForm.next.trim()
    if (!code) return toast('请输入恢复码')
    if (next.length < 6) return toast('新密码至少 6 位')
    if (next !== recoverForm.confirm.trim()) return toast('两次输入的新密码不一致')
    setRecovering(true)
    try {
      const res = await recoverPassword({ code, newPassword: next })
      hapticFeedback()
      setShowRecover(false)
      // 重设成功即已登录，先展示新恢复码（旧的已作废），关闭后进入系统
      setRecoveryCode(res.recoveryCode)
    } catch {
      // 具体原因已由请求封装 toast（恢复码错误/频繁锁定等）
    } finally {
      setRecovering(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-6"
      style={{ background: 'var(--canvas)' }}
    >
      <div className="w-full max-w-[360px] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-[14px]" />
        <div
          className="mt-4 text-[20px] font-semibold"
          style={{ color: 'var(--ink)', letterSpacing: '-0.4px' }}
        >
          汽修管理系统
        </div>
        <div className="mt-2 mb-6 text-[13px]" style={{ color: 'var(--ink-subtle)' }}>
          {initialized ? '输入访问密码继续' : '首次使用，请设置访问密码'}
        </div>

        <form
          className="flex flex-col gap-3 rounded-lg"
          onSubmit={e => {
            e.preventDefault()
            void submit()
          }}
        >
          <Input
            type="password"
            name="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={initialized ? '访问密码' : '设置密码（至少 6 位）'}
            maxLength={32}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            className="h-11"
          />
          {/* 首次设置需二次确认，避免手误锁死 */}
          {!initialized && (
            <Input
              type="password"
              name="confirm"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="确认密码"
              maxLength={32}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="h-11"
            />
          )}
          <Button type="submit" className="mt-1 h-11" disabled={loading}>
            {loading && <Loader2 className="animate-spin" />}
            {initialized ? '进入系统' : '保存并进入'}
          </Button>
        </form>

        {initialized && (
          <button
            type="button"
            className="pressable mt-3 text-[13px]"
            style={{ color: 'var(--primary)' }}
            onClick={openRecover}
          >
            忘记密码？
          </button>
        )}

        <div className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--ink-tertiary)' }}>
          {initialized
            ? '密码用于保护客户与经营数据，忘记时可用恢复码找回'
            : '设置完成后会生成找回密码的恢复码，请妥善保存'}
        </div>
      </div>

      {/* 找回密码：恢复码 + 新密码 */}
      <BottomSheet open={showRecover} onOpenChange={setShowRecover} title="找回密码">
        <div className="flex flex-col gap-3">
          <Field label="恢复码">
            <Input
              value={recoverForm.code}
              maxLength={10}
              placeholder="设置密码时显示的 8 位码"
              autoCapitalize="characters"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="h-10 font-mono uppercase"
              onChange={e => setRecoverForm(f => ({ ...f, code: e.target.value }))}
            />
          </Field>
          <Field label="新密码">
            <Input
              type="password"
              value={recoverForm.next}
              maxLength={32}
              placeholder="至少 6 位"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="h-10"
              onChange={e => setRecoverForm(f => ({ ...f, next: e.target.value }))}
            />
          </Field>
          <Field label="确认新密码">
            <Input
              type="password"
              value={recoverForm.confirm}
              maxLength={32}
              placeholder="再次输入新密码"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="h-10"
              onChange={e => setRecoverForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </Field>
          <Button className="mt-2 h-10" disabled={recovering} onClick={() => void submitRecover()}>
            {recovering && <Loader2 className="animate-spin" />}
            重设密码并进入
          </Button>
          <div className="text-[12px] leading-relaxed" style={{ color: 'var(--ink-tertiary)' }}>
            没有恢复码？需正常登录一次，在「设置」中生成。
          </div>
        </div>
      </BottomSheet>

      {/* 一次性恢复码展示（设置密码 / 找回密码成功后） */}
      <RecoveryCodeSheet open={!!recoveryCode} code={recoveryCode} onDone={recoveryDone} />
    </div>
  )
}
