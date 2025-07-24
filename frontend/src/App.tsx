import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './App.css';
import PatientPage from './pages/PatientPage';
import ReportPage from './pages/ReportPage';
// import Index from './pages/index';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PatientPage />} />
        <Route path="/report" element={<ReportPage />} />
        {/* <Route path="/index" element={<Index />} /> */}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
