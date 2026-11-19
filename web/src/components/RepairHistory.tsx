// 客户和车辆档案共用维修记录行：跨车辆时先认车，同一辆车则先看当次诉求。
import Link from 'next/link'
import { StatusBadge } from '@/components/mobile/Badge'
import { formatDateTime } from '@/lib/format'
import { fenToYuan } from '@/lib/money'
import type { WorkOrder } from '@/lib/types'

export default function RepairHistory({ orders, showPlate = false }: { orders: WorkOrder[]; showPlate?: boolean }) {
  return (
    <ul className="repair-history">
      {orders.map(order => {
        const plate = showPlate && order.vehicle?.plateNumber
        const title = plate || order.complaint || order.orderNo
        const items = order.repairItems || []
        return (
          <li key={order.id}>
            <Link href={`/orders/${order.id}`} className="history-entry">
              <span className={plate || title === order.orderNo ? 'order-plate' : 'history-complaint'}>{title}</span>
              <StatusBadge status={order.status} />
              {plate && order.complaint && <span className="history-items">{order.complaint}</span>}
              {items.length > 0 && <span className="history-items">{items.slice(0, 3).map(i => i.name).join('、')}{items.length > 3 && ` +${items.length - 3}`}</span>}
              <span className="history-meta"><time>{formatDateTime(order.createdAt)}</time>{title !== order.orderNo && <span>{order.orderNo}</span>}</span>
              {!!order.settlement?.actualAmount && <span className="history-amount">{!showPlate && '消费 '}¥{fenToYuan(order.settlement.actualAmount)}</span>}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
