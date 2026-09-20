'use client'

// tab 平级切换：快速交叉淡入（方向性推入只用于层级跳转，见各详情页 template）
export default function TabsTemplate({
  children
}: {
  children: React.ReactNode
}) {
  return <div className="page-fade">{children}</div>
}
