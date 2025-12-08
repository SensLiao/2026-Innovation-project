import {create } from 'zustand';
import { api } from '../lib/api';

export const useSegDB = create((set, get) => ({
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
}));