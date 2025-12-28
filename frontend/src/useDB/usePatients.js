import {create} from 'zustand';
import { api } from '../lib/api';


const BASE_URL = import.meta.env.VITE_API_BASE?.replace('/api', '') || 'http://localhost:3000';

export const usePatientDB = create((set, get) => ({
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
            const response = await api.put(`/patients/${pid}`, patientData);
            set({ currentPatient: response.data.data });
            console.log("Patient updated successfully");
        } catch (error) {
            console.log("Error updating patient:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    }
    
    
}));