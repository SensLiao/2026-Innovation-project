import {create } from 'zustand';
import { api } from '../lib/api';

export const useSegStore = create((set, get) => ({
  segs: [],
  loading: false,
  error: null,
  currentSeg: null,

  segData: {
    sid: null,
    uid: null,
    pid: null,
    model: '',
    uploadimage: '',
    origimsize: [],
    createdat: '',
    masks: [],
  },

  // 分割统计
  segStats: {
    total: 0
  },
  weeklySEgStats: {
    total: 0
  },
  statsLoading: false,
  statsError: null,

  setSegData: (segData) => set({ segData }),
  resetSegData: () => set({ segData: {
    sid: null,
    uid: null,
    pid: null,
    model: '',
    uploadimage: '',
    origimsize: [],
    createdat: '',
    masks: [],
  }}),

  fetchSegs: async () => {
        set({ loading: true });
        try {
            const response = await api.get('/segs');
            set({ 
                segs: response.data.data, 
                error:null 
            });
        } catch (error) {
            set({ error: error.message, segs: [] });
        } finally {
            set({ loading: false });
        }
    },

    fetchSegByID: async(sid) =>{
        set({ loading: true });
        try {
            const response = await api.get(`/segs/${sid}`);
            set({ 
                currentSeg: response.data.data,
                segData: response.data.data, //pre-fill form with current Seg data
                error: null 
            });
        } catch (error) {
            console.log("Error fetching segmentation by SID:", error);
            set({ error: error.message, currentPatient: null });
        } finally {
            set({ loading: false });
        }
    },

    addSeg: async (payload) => {
        set({ loading: true });
        try {
            await api.post('/segs', payload);
        } catch (error) {
            console.log("Error adding segmentation:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    },

    // 获取分割总数
    fetchTotalSegs: async () => {
        set({ statsLoading: true, statsError: null });
        try {
            const response = await api.get(`/segs/stats/total`);
            if (response.data.success) {
                set((state) => ({
                    segStats: { ...state.segStats, total: response.data.data },
                    statsError: null
                }));
            }
        } catch (error) {
            console.error("Error fetching total segs:", error);
            set({ statsError: error.message });
        } finally {
            set({ statsLoading: false });
        }
    },

    // 获取本周新增分割数
    fetchSegsThisWeek: async () => {
        set({ statsLoading: true, statsError: null });
        try {
            const response = await api.get(`/segs/stats/weekly`);
            if (response.data.success) {
                set((state) => ({
                    weeklySEgStats: { ...state.weeklySEgStats, total: response.data.data },
                    statsError: null
                }));
            }
        } catch (error) {
            console.error("Error fetching weekly segs:", error);
            set({ statsError: error.message });
        } finally {
            set({ statsLoading: false });
        }
    },

    // 获取所有分割统计
    // total: 累计总共的CT scan分割数；
    // weekly: 本周新增CT scan分割数
    fetchAllSegStats: async () => {
        set({ statsLoading: true, statsError: null });
        try {
            const [total, weekly] = await Promise.all([
                api.get(`/segs/stats/total`),
                api.get(`/segs/stats/weekly`)
            ]);

            if (total.data.success && weekly.data.success) {
                set({
                    segStats: { total: total.data.data },
                    weeklySEgStats: { total: weekly.data.data },
                    statsError: null
                });
            }
        } catch (error) {
            console.error("Error fetching all seg stats:", error);
            set({ statsError: error.message });
        } finally {
            set({ statsLoading: false });
        }
    }
}));
