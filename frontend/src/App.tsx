import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import PatientPage from '@/pages/PatientPage';
import ReportPage from '@/pages/ReportPage';
import Index from '@/pages/index';

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";


function App() {
  return (
  <TooltipProvider>
  <Toaster />
  <Sonner />
  <BrowserRouter>
    <Routes>
    <Route path="/" element={<PatientPage />} />
    <Route path="/report" element={<ReportPage />} />
    <Route path="/index" element={<Index />} />
    </Routes>
  </BrowserRouter>
  </TooltipProvider>

  );
}

export default App;
