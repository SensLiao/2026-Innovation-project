import {create } from 'zustand';
import { api } from '../lib/api';

export const useAuth = create((set, get) => ({
  user: null, // 当前登录用户
  loading: false,
  error: null,

  login: async (email, password) => {
        set({ loading: true, error: null });
        try {
            await api.post('/auth/login', { email, password });
            const {data} = await api.get('/auth/me');
            set ({user: data});
            return true;
        } catch (e) {
            set({ error: e?.response?.data?.error || "Login Failed" });
            return false;
        } finally {
            set({ loading: false });
        }
    },

    fetchMe: async () => {
        set({ loading: true, error: null });
        try {
            const {data} = await api.get('/auth/me');
            set ({user: data, error: null});
            return true;
        } catch (e) {
            set({ user:null, error: e?.response?.data?.error || "Fetch User Failed" });
            return false;
        } finally {
            set({ loading: false });
        }
    },

    logout: async () => {
        await api.post('/auth/logout');
        set({ user: null });
    },
}));


