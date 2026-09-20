// tab 页布局：页面自带 page-frame 骨架，此处只挂底部标签栏
import BottomTabBar from '@/components/mobile/BottomTabBar'

export default function TabsLayout({
  children
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
      <BottomTabBar />
    </>
  )
}
