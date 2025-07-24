// Shared TypeScript interfaces for use in both frontend and backend

export interface User {
  id: number;
  name: string;
  profilephoto: string;
}

export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone?: string;
  email?: string;
  profilephoto: string;
} 