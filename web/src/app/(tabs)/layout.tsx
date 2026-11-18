// 工作区布局：页面保留独立滚动骨架，导航随屏幕宽度切换位置
import BottomTabBar from '@/components/mobile/BottomTabBar'

export default function TabsLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <div className="tabs-shell">
      {children}
      <BottomTabBar />
    </div>
  )
}
