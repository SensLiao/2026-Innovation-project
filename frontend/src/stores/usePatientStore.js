import {create} from 'zustand';
import { api } from '../lib/api';


const BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:3000';

export const usePatientStore = create((set, get) => ({
    patients: [],
    loading: false,
    error: null,
    currentPatient: null,

    patientData: {
        pid: null,
        name: '',
        age: '',
        dateofbirth: '',
        gender: '',
        phone: '',
        email: '',
        profilephoto: '',
        createdat: '',
        emergencycontactname: '',
        emergencycontactphone: '',
        streetaddress: '',
        suburb: '',
        state: '',
        postcode: '',
        country: '',
    },

    // 患者统计
    patientStats: {
        total: 0
    },
    weeklyPatientStats: {
        total: 0
    },
    statsLoading: false,
    statsError: null,

    setPatientData: (patientData) => set({ patientData }),
    resetPatientData: () => set({ patientData: {
        pid: null,
        name: '',
        age: '',
        dateofbirth: '',
        gender: '',
        phone: '',
        email: '',
        profilephoto: '',
        createdat: '',
        emergencycontactname: '',
        emergencycontactphone: '',
        streetaddress: '',
        suburb: '',
        state: '',
        postcode: '',
        country: '',
    }}),
    
    fetchPatients: async () => {
        set({ loading: true });
        try {
            const response = await api.get(`/patients`);
            set({ patients: response.data.data, error:null });
        } catch (error) {
            set({ error: error.message, patients: [] });
        } finally {
            set({ loading: false });
        }
    },

    fetchPatientByID: async(pid) =>{
        set({ loading: true });
        try {
            const response = await api.get(`/patients/${pid}`);
            set({ 
                currentPatient: response.data.data,
                patientData: response.data.data, //pre-fill form with current patient data
                error: null 
            });
        } catch (error) {
            console.log("Error fetching patient by ID:", error);
            set({ error: error.message, currentPatient: null });
        } finally {
            set({ loading: false });
        }
    },

    deletePatient: async(pid)=>{
        set({loading:true});
        try{
            await api.delete(`/patients/${pid}`);
            set((state) => ({
                patients: state.patients.filter(patient => patient.pid !== pid),
                error: null
            }));
        }catch (error) {
            console.log("Error deleting patient:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    },

    addPatient:async(e)=> {
        e.preventDefault();
        set({ loading: true });
        try {
            const { patientData } = get();
            // Send POST request to add user
            await api.post(`/patients`, patientData);
            
            //Refetch data
            await get().fetchPatients();
            get().resetPatientData();
            console.log("Patient added successfully");
            document.getElementById("add_patient_modal").close();
        } catch (error) {
            console.log("Error adding patient:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    },

    updatePatient: async (pid) => {
        set({ loading: true });
        try {
            const { patientData } = get();
            // Use a longer timeout for large payloads (e.g., base64 images)
            const response = await api.put(`/patients/${pid}`, patientData, { timeout: 60000 });
            set({ currentPatient: response.data.data });
            console.log("Patient updated successfully");
            return response.data.data;
        } catch (error) {
            console.log("Error updating patient:", error);
            set({ error: error.message });
            throw error;
        } finally {
            set({ loading: false });
        }
    },

    // 获取患者总数
    fetchTotalPatients: async () => {
        set({ statsLoading: true, statsError: null });
        try {
            const response = await api.get(`/patients/stats/total`);
            if (response.data.success) {
                set((state) => ({
                    patientStats: { ...state.patientStats, total: response.data.data },
                    statsError: null
                }));
            }
        } catch (error) {
            console.error("Error fetching total patients:", error);
            set({ statsError: error.message });
        } finally {
            set({ statsLoading: false });
        }
    },

    // 获取本周新增患者数
    fetchPatientsThisWeek: async () => {
        set({ statsLoading: true, statsError: null });
        try {
            const response = await api.get(`/patients/stats/weekly`);
            if (response.data.success) {
                set((state) => ({
                    weeklyPatientStats: { ...state.weeklyPatientStats, total: response.data.data },
                    statsError: null
                }));
            }
        } catch (error) {
            console.error("Error fetching weekly patients:", error);
            set({ statsError: error.message });
        } finally {
            set({ statsLoading: false });
        }
    },
    
    
    // 获取所有患者统计
    // total: 累计总共患者数；
    // weekly: 本周新增患者数
    fetchAllPatientStats: async () => {
        set({ statsLoading: true, statsError: null });
        try {
            const [total, weekly] = await Promise.all([
                api.get(`/patients/stats/total`),
                api.get(`/patients/stats/weekly`)
            ]);

            if (total.data.success && weekly.data.success) {
                set({
                    patientStats: { total: total.data.data },
                    weeklyPatientStats: { total: weekly.data.data },
                    statsError: null
                });
            }
        } catch (error) {
            console.error("Error fetching all patient stats:", error);
            set({ statsError: error.message });
        } finally {
            set({ statsLoading: false });
        }
    },

}));