'use client'

// 详情页加载骨架：首卡（标题/车牌+徽章）+ 若干信息卡占位，数据到达前避免空白干等
// （自旧 client/src/components/PageSkeleton.vue 移植）
interface PageSkeletonProps {
  /** 首卡之外的信息卡数量 */
  cards?: number
}

export default function PageSkeleton({ cards = 2 }: PageSkeletonProps) {
  return (
    <div className="page-content">
      {/* 首卡：标题行 + 元信息行 + 右侧状态徽章位 */}
      <div className="card">
        <div className="flex-between">
          <div className="flex-1">
            <div className="sk sk-line" style={{ width: '42%' }} />
            <div className="sk sk-sm" style={{ width: '62%', marginTop: 10 }} />
          </div>
          <div className="sk sk-pill" />
        </div>
      </div>
      {/* 信息卡：小标题 + 两行内容（第二行窄），数量按页面信息量配置 */}
      {Array.from({ length: cards }, (_, i) => (
        <div className="card" key={i}>
          <div className="sk sk-sm" style={{ width: '26%' }} />
          <div className="sk sk-line" style={{ width: '76%', marginTop: 12 }} />
          <div className="sk sk-sm" style={{ width: '52%', marginTop: 8 }} />
        </div>
      ))}
    </div>
  )
}
