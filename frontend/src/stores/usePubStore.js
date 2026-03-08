import {create} from 'zustand';
import { api } from '../lib/api';

const BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:3000';

export const usePubStore = create((set, get) => ({
    publications: [],
    loading: false,
    error: null,

    fetchPublicationsByUid: async (uid) => {
        set({ loading: true });
        try {
            const response = await api.get(`/publications/${uid}`);
            set({ publications: response.data.data || [], error: null });
        } catch (error) {
            set({ error: error.message, publications: [] });
        } finally {
            set({ loading: false });
        }
    },
    addPublication: async (uid, publication) => {
        set({ loading: true });
        try {
            const response = await api.post(`/publications/${uid}`, publication);
            const newPub = response.data.data;
            // append to existing list
            set((state) => ({
                publications: [...state.publications, newPub],
                error: null,
            }));
            return newPub;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    updatePublication: async (pid, publication) => {
        set({ loading: true });
        try {
            const response = await api.put(`/publications/${pid}`, publication);
            const updated = response.data.data;
            set((state) => ({
                publications: state.publications.map((p) => (p.PID === pid ? updated : p)),
                error: null,
            }));
            return updated;
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    deletePublication: async (pid) => {
        set({ loading: true });
        try {
            await api.delete(`/publications/${pid}`);
            set((state) => ({
                publications: state.publications.filter((p) => p.pid !== pid),
                error: null,
            }));
        } catch (error) {
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },}));
