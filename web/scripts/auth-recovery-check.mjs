// 恢复码找回密码全流程验证（针对本地运行的服务执行）
// 用法：node scripts/auth-recovery-check.mjs [baseUrl，默认 http://127.0.0.1:8891]
// 前置：数据库为未初始化状态（prisma migrate reset 后）
const B = process.argv[2] || 'http://127.0.0.1:8891'
let cookie = ''

const call = async (method, url, body) => {
  const res = await fetch(B + url, {
    method,
    headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined
  })
  const sc = res.headers.get('set-cookie')
  if (sc) cookie = sc.split(';')[0]
  const data = await res.json().catch(() => null)
  return { status: res.status, data }
}

const assert = (cond, msg) => {
  if (!cond) {
    console.error('失败：' + msg)
    process.exit(1)
  }
  console.log('通过：' + msg)
}

// 1 初始状态未初始化
let r = await call('GET', '/api/auth/status')
assert(r.status === 200 && r.data.initialized === false, '初始状态未初始化')

// 2 设置密码 → 返回 8 位恢复码（去混淆字母表）
r = await call('POST', '/api/auth/setup', { password: 'abc123' })
assert(r.status === 200 && /^[A-Z2-9]{8}$/.test(r.data.recoveryCode || ''), '设置密码返回 8 位恢复码')
const code1 = r.data.recoveryCode

// 3 错误恢复码 → 401
r = await call('POST', '/api/auth/recover', { code: 'WRONGCODE', newPassword: 'newpass1' })
assert(r.status === 401, '错误恢复码被拒')

// 4 正确恢复码（小写无分隔符，验证输入归一化）重设密码
r = await call('POST', '/api/auth/recover', { code: code1.toLowerCase(), newPassword: 'xyz789xyz' })
assert(r.status === 200 && /^[A-Z2-9]{8}$/.test(r.data.recoveryCode || ''), '恢复码重设成功并换发新码')
const code2 = r.data.recoveryCode

// 5 新密码可登录、旧密码失效
r = await call('POST', '/api/auth/login', { password: 'xyz789xyz' })
assert(r.status === 200, '新密码可登录')
r = await call('POST', '/api/auth/login', { password: 'abc123' })
assert(r.status === 401, '旧密码已失效')

// 6 旧恢复码一次性：已作废
r = await call('POST', '/api/auth/recover', { code: code1, newPassword: 'whatever1' })
assert(r.status === 401, '旧恢复码已作废')

// 7 登录后重新生成恢复码
r = await call('POST', '/api/auth/recovery-code')
assert(r.status === 200 && /^[A-Z2-9]{8}$/.test(r.data.recoveryCode || ''), '重新生成恢复码')
assert(r.data.recoveryCode !== code2, '重新生成的码与旧码不同')
const code3 = r.data.recoveryCode

// 8 用重新生成的码找回
r = await call('POST', '/api/auth/recover', { code: code3, newPassword: 'finalpass1' })
assert(r.status === 200, '重新生成的码可找回')
r = await call('POST', '/api/auth/login', { password: 'finalpass1' })
assert(r.status === 200, '最终密码可登录')

console.log('全部恢复码流程用例通过 ✓')
