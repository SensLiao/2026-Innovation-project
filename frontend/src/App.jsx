import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import PatientPage from './pages/PatientPage'
import LoginPage from './pages/LoginPage';
import UserProfilePage from './pages/UserProfilePage';

function App() {
  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/patient" element={<PatientPage />} />
          <Route path="/profile" element={<UserProfilePage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App
