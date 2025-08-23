import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// ------- DD/MM/YYYY formatter -------
export const toDDMMYYYY = (value) => {
  if (!value) return "—";
  if (value?.toDate) value = value.toDate();
  if (value?.seconds) value = new Date(value.seconds * 1000);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

const Header = ({ 
  activeTab = "patient", 
  showLogout = true, 
  showAddPatient = false,
  onAddPatientClick 
}) => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [profileUrl, setProfileUrl] = useState("");

  // Get profile photo from state or localStorage
  useEffect(() => {
    const getProfilePhoto = () => {
      const photo = state?.profilephoto || 
                   state?.profileUrl || 
                   (() => {
                     try {
                       const u = JSON.parse(localStorage.getItem("currentUser") || "{}");
                       return u?.profilephoto || u?.profileUrl || "";
                     } catch {
                       return "";
                     }
                   })();
      setProfileUrl(photo);
    };

    getProfilePhoto();

    // Listen for localStorage changes (when profile photo is updated)
    const handleStorageChange = () => {
      getProfilePhoto();
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check localStorage periodically for changes
    const interval = setInterval(getProfilePhoto, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [state]);



  const handleLogout = () => {
    navigate("/", { replace: true });
  };

  const handleProfileClick = () => {
    const userInfo = state || {};
    navigate("/profile", { state: userInfo });
  };

  const getTabClass = (tabName) => {
    const isActive = activeTab === tabName;
    return isActive 
      ? "text-black font-medium border-b-2 border-black pb-1" 
      : "hover:text-black";
  };
  
  return (
    <div className="flex items-center justify-between">
      <div className="text-5xl font-extrabold tracking-tight">LOGO</div>

      {/* Right group: tabs + avatar */}
      <div className="ml-auto flex items-center gap-6">
        <nav className="hidden sm:flex gap-8 text-gray-500 text-sm md:text-base">
          <button 
            className={`${getTabClass("patient")} bg-transparent border-none cursor-pointer`}
            onClick={() => navigate("/patient")}
          >
            Patient
          </button>
          <button 
            className={`${getTabClass("segmentation")} bg-transparent border-none cursor-pointer`}
            onClick={() => navigate("/segmentation")}
          >
            Segmentation
          </button>
          <button 
            className={`${getTabClass("report")} bg-transparent border-none cursor-pointer`}
            onClick={() => navigate("/report")}
          >
            Report
          </button>
          <button 
            className={`${getTabClass("segmentation")} bg-transparent border-none cursor-pointer`}
            onClick={() => navigate("/history")}
          >
            History
          </button>
        </nav>

        <div
          className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white bg-gray-100 cursor-pointer"
          onClick={handleProfileClick}
          title="View Profile"
        >
          {profileUrl ? (
            <img src={profileUrl} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-gray-500">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      

      {/* Logout and Add Patient Buttons (bottom left) */}
      <div className="absolute left-4 bottom-0 -translate-y-1/2 flex gap-3 z-10">
        {showLogout && (
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-gray-900 text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 shadow-md"
          >
            Logout
          </button>
        )}
        {showAddPatient && (
          <button
            onClick={onAddPatientClick}
            className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 shadow-md"
          >
            Add Patient
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;
