import {create} from 'zustand';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

export const usePatientsStore = create((set, get) => ({
    patients: [],
    loading: false,
    error: null,
    
    fetchPatients: async () => {
        set({ loading: true });
        try {
            const response = await axios.get(`${BASE_URL}/api/patients`);
            set({ patients: response.data.data, error:null });
        } catch (error) {
            set({ error: error.message, patients: [] });
        } finally {
            set({ loading: false });
        }
    },
    
    // addPatient: async (patient) => {
    //     set({ loading: true, error: null });
    //     try {
    //     const response = await axios.post(`${BASE_URL}/patients`, patient);
    //     set((state) => ({
    //         patients: [...state.patients, response.data],
    //         loading: false
    //     }));
    //     } catch (error) {
    //     set({ error: error.message, loading: false });
    //     }
    // }
}));