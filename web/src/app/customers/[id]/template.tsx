'use client'

// 详情页路由过渡：从右滑入（对应旧 push 过渡）
export default function PushTemplate({
  children
}: {
  children: React.ReactNode
}) {
  return <div className="page-push">{children}</div>
}
