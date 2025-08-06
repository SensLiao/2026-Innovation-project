import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import PatientPage from './pages/patientPage'
import LoginPage from './pages/LoginPage';
import ProfilePhotoPage from './pages/ProfilePhotoPage';

function App() {
  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<PatientPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile-photo" element={<ProfilePhotoPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App
