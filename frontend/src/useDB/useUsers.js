import {create} from 'zustand';
import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

export const useUserDB = create((set, get) => ({
    users: [],
    loading: false,
    error: null,
    currentUser: null,

    userData:{
        uid: '',
        name: '',
        email: '',
        phone: '',
        passwordhash: '',
        profilephoto: '',
        createdat: '',
        yearofexperience: '',
        education: '',
        languages: '',
    },

    setuserData: (userData) => set({ userData }),
    resetuserData: () => set({ userData: { 
        uid: '',
        name: '', 
        email: '', 
        phone: '', 
        passwordhash: '',
        profilephoto: '',
        createdat: '',
        yearofexperience: '',
        education: '',
        languages: '',
    } }),

    signupData: {
        name: '',
        email: '',
        phone: '',
        password: '',
    },

    setSignupData: (signupData) => set({ signupData }),
    resetSignupData: () => set({ signupData: { name: '', email: '', phone: '', password: '' } }),
    
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

    fetchUserByID: async (uid) => {
        set({ loading: true });
        try {
            const response = await axios.get(`${BASE_URL}/api/users/${uid}`);
            set({ 
                currentUser: response.data.data,
                userData: response.data.data,  //pre-fill form with current user data
                error: null });
        } catch (error) {
            console.log("Error fetching user by ID:", error);
            set({ error: error.message, currentUser: null });
        } finally {
            set({ loading: false });
        }
    },

    updateUser: async (uid) => {
        set({ loading: true });
        try {
            const { userData } = get();
            const response = await axios.put(`${BASE_URL}/api/users/${uid}`, userData);
            set({ currentUser: response.data.data });
            console.log("User updated successfully");
        } catch (error) {
            console.log("Error updating user:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    },

    deleteUser: async (uid) => {
        set({ loading: true });
        try {
            await axios.delete(`${BASE_URL}/api/users/${uid}`);
            set((state) => ({
                users: state.users.filter(user => user.uid !== uid),
                error: null
            }));
        } catch (error) {
            console.log("Error deleting user:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    },

    addUser:async(e)=> {
        e.preventDefault();
        set({ loading: true });
        try {
            const { signupData } = get();
            const passwordhash = btoa(signupData.password); // Simple base64 encoding for passwordhash
            const newUser = {
                name: signupData.name,
                email: signupData.email,
                phone: signupData.phone,
                passwordhash: passwordhash,
            };
            // Send POST request to add user
            await axios.post(`${BASE_URL}/api/users`, newUser);
            
            //Refetch data
            await get().fetchUsers();
            get().resetSignupData();
            console.log("User added successfully");
        } catch (error) {
            console.log("Error adding user:", error);
            set({ error: error.message });
        } finally {
            set({ loading: false });
        }
    }

}));