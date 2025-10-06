import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import PatientPage from './pages/PatientPage'
import LoginPage from './pages/LoginPage';
import UserProfilePage from './pages/UserProfilePage';
import PatientProfilePage from './pages/PatientProfilePage';
import HistoryPage from './pages/HistoryPage';
import Segmentation from './pages/Segmentation';
import ImageUploadTest from './pages/ImageUploadTest';
import RequireAuth from './components/RequireAuth';

function App() {
  return (
    <BrowserRouter>
      <div>
        <Routes>
          <Route path="/" element={<LoginPage />} />

          <Route element={<RequireAuth/>}>
            <Route path="/patient" element={<PatientPage />} />
            <Route path="/patient/:pid" element={<PatientProfilePage />} />
            <Route path="/profile" element={<UserProfilePage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/segmentation" element={<Segmentation />} />
            <Route path="/image-upload-test" element={<ImageUploadTest />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App
