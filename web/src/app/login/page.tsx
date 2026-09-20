'use client'

// 访问验证页：首次进入引导设置访问密码，之后凭密码登录（单用户访问控制，见 API auth 路由）
// （自旧 client/src/views/Login.vue 移植）
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { getAuthStatus, getAuthMe, setupPassword, loginPassword } from '@/lib/api'
import { hapticFeedback } from '@/lib/feedback'

export default function LoginPage() {
  const router = useRouter()

  // 是否已初始化密码：决定展示「设置」还是「登录」形态
  const [initialized, setInitialized] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

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
        await setupPassword({ password: pw })
      } else {
        await loginPassword({ password: pw })
      }
      hapticFeedback()
      router.replace('/')
    } catch {
      // 具体原因已由请求封装 toast（密码错误/频繁锁定等）
    } finally {
      setLoading(false)
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

        <div className="mt-4 text-[12px] leading-relaxed" style={{ color: 'var(--ink-tertiary)' }}>
          {initialized ? '密码用于保护客户与经营数据' : '密码丢失需在数据库清除 settings 表后重新设置'}
        </div>
      </div>
    </div>
  )
}
