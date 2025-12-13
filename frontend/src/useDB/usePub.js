import {create} from 'zustand';
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:3000';

export const usePubDB = create((set, get) => ({
    publications: [],
    loading: false,
    error: null,

    fetchPublicationsByUid: async (uid) => {
        set({ loading: true });
        try {
            const response = await axios.get(`${BASE_URL}/api/publications/${uid}`);
            set({ publications: response.data.data || [], error: null });
        } catch (error) {
            set({ error: error.message, publications: [] });
        } finally {
            set({ loading: false });
        }
    },
}));