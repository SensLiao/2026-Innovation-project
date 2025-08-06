import {create} from 'zustand';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

export const useUserDB = create((set, get) => ({
    users: [],
    loading: false,
    error: null,
    
    fetchUsers: async () => {
        set({ loading: true });
        try {
            const response = await axios.get(`${BASE_URL}/api/users`);
            set({ users: response.data.data, error:null });
        } catch (error) {
            set({ error: error.message, users: [] });
        } finally {
            set({ loading: false });
        }
    },
}));