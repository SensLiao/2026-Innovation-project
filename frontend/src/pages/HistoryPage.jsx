import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import "./patient.css";


const HistoryPage = () => {
  const { state } = useLocation();

  return (
    <div className="min-h-screen bg-[#C2DCE7] p-6 md:p-10 flex justify-center">
      <div className="relative w-full max-w-6xl">
        {/* White sheet */}
        <div className="bg-white rounded-3xl shadow-2xl px-6 md:px-12 py-8 md:py-10 relative">
          
          {/* Header - Note: activeTab is set to "history" and no Add Patient button */}
          <Header 
            activeTab="history"
            showLogout={true}
            showAddPatient={false}
          />

          {/* Title */}
          <div className="mt-10 md:mt-12">
            <h1 className="text-5xl md:text-6xl font-extrabold text-[#3B82F6] leading-none">
              Patient <span className="text-black text-4xl md:text-5xl font-semibold">History</span>
            </h1>
            <div className="mt-4 text-gray-500 text-lg">
              <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle mr-3" />
              <span className="align-middle">View patient treatment history and records</span>
              <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle ml-3" />
            </div>
          </div>

          {/* Content placeholder */}
          <div className="mt-10 p-8 bg-gray-50 rounded-lg">
            <div className="text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No history records</h3>
              <p className="mt-1 text-sm text-gray-500">
                Patient history and treatment records will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
