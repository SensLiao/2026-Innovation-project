// src/lib/api.js
import axios from "axios";
import { useAuth } from "../useDB/useAuth";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://localhost:3000/api",
  withCredentials: true,
  timeout: 15000,
});

// 响应拦截
// 后端返回401，自动登出跳回登陆页面
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err?.response?.status;
    if (status === 401) {
      // 会话失效：清空本地 user，必要时跳转登录
      try { useAuth.getState().logout(); } catch {}
      // 可选：window.location.href = "/";
    }
    return Promise.reject(err);
  }
);
