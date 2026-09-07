import axios from 'axios'
import { showToast } from 'vant'
import router from '@/router'

const request = axios.create({
  baseURL: '/api',
  timeout: 15000
})

request.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => Promise.reject(error)
)

request.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const status = error.response?.status
    const message = error.response?.data?.message || error.message || '请求失败'
    // 会话失效:静默跳转登录页(登录接口自身的 401 除外,由登录页提示)
    if (status === 401 && router.currentRoute.value.path !== '/login') {
      router.replace('/login')
      return Promise.reject(error)
    }
    // 调用方标记 skipToast 的请求(如登录页的会话探测)不弹提示
    if (error.config?.skipToast) {
      return Promise.reject(error)
    }
    // 错误提示用纯文字 toast(不加图标,保持克制;错误语义由文案表达)
    showToast(message)
    return Promise.reject(error)
  }
)

// 拦截器已返回 response.data，此处断言为 any 避免 AxiosResponse 类型干扰
export default request as any
