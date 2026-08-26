import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: () => import('@/layouts/TabBarLayout.vue'),
    children: [
      {
        path: '',
        name: 'Home',
        component: () => import('@/views/Home.vue'),
        meta: { title: '工作台' }
      },
      {
        path: 'orders',
        name: 'Orders',
        component: () => import('@/views/Orders.vue'),
        meta: { title: '工单' }
      },
      {
        path: 'customers',
        name: 'Customers',
        component: () => import('@/views/Customers.vue'),
        meta: { title: '客户' }
      },
      {
        path: 'reminders',
        name: 'Reminders',
        component: () => import('@/views/Reminders.vue'),
        meta: { title: '提醒' }
      }
    ]
  },
  {
    path: '/checkin',
    name: 'Checkin',
    component: () => import('@/views/Checkin.vue'),
    meta: { title: '接车登记' }
  },
  {
    path: '/orders/:id',
    name: 'OrderDetail',
    component: () => import('@/views/OrderDetail.vue'),
    meta: { title: '工单详情' }
  },
  {
    path: '/customers/:id',
    name: 'CustomerDetail',
    component: () => import('@/views/CustomerDetail.vue'),
    meta: { title: '客户详情' }
  },
  {
    path: '/vehicles/:id',
    name: 'VehicleDetail',
    component: () => import('@/views/VehicleDetail.vue'),
    meta: { title: '车辆详情' }
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@/views/Stats.vue'),
    meta: { title: '统计报表' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.afterEach((to) => {
  document.title = (to.meta.title as string) || '汽修管理系统'
})

export default router
