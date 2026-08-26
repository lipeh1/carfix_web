import axios from 'axios'
import { showToast } from 'vant'

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
    const message = error.response?.data?.message || error.message || '请求失败'
    showToast({ type: 'fail', message })
    return Promise.reject(error)
  }
)

// 拦截器已返回 response.data，此处断言为 any 避免 AxiosResponse 类型干扰
export default request as any
