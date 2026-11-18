// 空状态沿用业务提示文案，以一行留白呈现，不为无内容区域增加装饰卡片

export default function Empty({ description }: { description: string }) {
  return (
    <p className="empty-state">{description}</p>
  )
}
