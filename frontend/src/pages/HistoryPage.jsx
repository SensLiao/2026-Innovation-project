import React from "react";
import { useLocation } from "react-router-dom";
import Header from "../components/Header";
import "./patient.css";
import Decoration from '../assets/images/main2.png';


const HistoryPage = () => {
  const { state } = useLocation();

  return (
    <div className="min-h-screen bg-[#C2DCE7] py-8">
      {/* Decorative blobs */}
      <div className="relative w-full max-w-6xl">
        <div className="absolute -right-20 bottom-80 hidden md:block deco-blob-sm" />
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-10 -left-60 z-0 pointer-events-none select-none"
        />

        {/* Fixed-width wrapper */}
        <div className="mx-auto w-[1200px]"> {/* <- fixed width, not max-w */}

        {/* White sheet */}
         <div className="bg-white rounded-3xl shadow-2xl p-8 relative w-full overflow-hidden min-h-[75vh] md:min-h-[80vh] pb-20">
   
          {/* Header - Note: activeTab is set to "history" and no Add Patient button */}
          <Header 
            activeTab="history"
            showLogout={true}
            // showAddPatient={false}
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
    </div>
  );
};

export default HistoryPage;

//Usage Example
// Example: DashboardPage.jsx or ReportStatsCard.jsx

import { useReportStore } from '../stores/useReportStore';
import { useEffect } from 'react';

export function ReportStatsCard() {
  const { 
    stats, 
    weeklyStats, 
    statsLoading, 
    weeklyStatsLoading,
    fetchAllStats, 
    fetchAllWeeklyStats 
  } = useReportStore();

  // Load both total and weekly stats on component mount
  useEffect(() => {
    fetchAllStats();        // Fetches: total, draft, revise, approved (all-time)
    fetchAllWeeklyStats();  // Fetches: draft, revise, approved (this week)
  }, [fetchAllStats, fetchAllWeeklyStats]);

  // Calculate percentages: weekly / total
  const calculatePercentage = (weekly, total) => {
    if (total === 0) return 0;
    return Math.round((weekly / total) * 100);
  };

  if (statsLoading || weeklyStatsLoading) {
    return <div>Loading statistics...</div>;
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      {/* Draft Reports Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Draft Reports</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold text-lg">{stats.draft}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Week:</span>
            <span className="font-bold text-lg text-blue-600">{weeklyStats.draft}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">Weekly %:</span>
            <span className="font-bold text-blue-600">
              {calculatePercentage(weeklyStats.draft, stats.draft)}%
            </span>
          </div>
        </div>
      </div>

      {/* Revising Reports Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Revising Reports</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold text-lg">{stats.revise}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Week:</span>
            <span className="font-bold text-lg text-yellow-600">{weeklyStats.revise}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">Weekly %:</span>
            <span className="font-bold text-yellow-600">
              {calculatePercentage(weeklyStats.revise, stats.revise)}%
            </span>
          </div>
        </div>
      </div>

      {/* Approved Reports Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Approved Reports</h3>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold text-lg">{stats.approved}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">This Week:</span>
            <span className="font-bold text-lg text-green-600">{weeklyStats.approved}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600">Weekly %:</span>
            <span className="font-bold text-green-600">
              {calculatePercentage(weeklyStats.approved, stats.approved)}%
            </span>
          </div>
        </div>
      </div>

      {/* Total Reports Overview */}
      <div className="bg-white rounded-lg shadow p-6 col-span-3">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">Overall Statistics</h3>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-gray-600">Total Reports</p>
            <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
          </div>
          <div>
            <p className="text-gray-600">Total This Week</p>
            <p className="text-3xl font-bold text-blue-600">
              {weeklyStats.draft + weeklyStats.revise + weeklyStats.approved}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Weekly %</p>
            <p className="text-3xl font-bold text-purple-600">
              {calculatePercentage(
                weeklyStats.draft + weeklyStats.revise + weeklyStats.approved,
                stats.total
              )}%
            </p>
          </div>
          <div>
            <p className="text-gray-600">Completion Rate</p>
            <p className="text-3xl font-bold text-green-600">
              {calculatePercentage(stats.approved, stats.total)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
