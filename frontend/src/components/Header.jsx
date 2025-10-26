import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../useDB/useAuth";
import Logo from "../assets/images/Logo.png";

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
  onAddPatientClick 
}) => {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    navigate("/", { replace: true }); 
    logout();
  };

  const handleProfileClick = () => {
    const userInfo = state || {};
    navigate("/profile", { state: userInfo });
  };

  const tabs = [
    { key: "patient", label: "Patient", path: "/patient" },
    { key: "segmentation", label: "Segmentation", path: "/segmentation" },
    { key: "report", label: "Report", path: "/report" },
    { key: "history", label: "History", path: "/history" },
  ];

  return (
    <div className="flex items-center justify-between bg-transparent">
      
      {/* Logo */}
      <img
        src={Logo}
        alt="Logo"
        className="w-[200px] object-contain pointer-events-none select-none"
      />

      {/* Tabs + Avatar */}
      <div className="ml-auto flex items-center gap-6">
        <nav className="hidden sm:flex gap-8 text-gray-500 text-sm md:text-base">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => navigate(tab.path)}
              className={`
                relative px-1 pb-1 font-medium transition-colors duration-200 
                bg-transparent border-none cursor-pointer
                ${activeTab === tab.key ? "text-black" : "hover:text-black"}
              `}
            >
              {tab.label}
              {/* Underline animation */}
              <span
                className={`
                  absolute left-0 -bottom-[2px] h-[2px] w-full bg-black rounded-full
                  transition-transform duration-300 ease-out
                  ${activeTab === tab.key ? "scale-x-100" : "scale-x-0"}
                `}
                style={{ transformOrigin: "center" }}
              ></span>
            </button>
          ))}
        </nav>

        {/* Avatar */}
        <div
          className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-white bg-gray-100 cursor-pointer"
          onClick={handleProfileClick}
          title="View Profile"
        >
          {user.profilephoto ? (
            <img src={user.profilephoto} alt="avatar" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-gray-500">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Logout */}
      <div className="absolute left-13 bottom-3 flex gap-3 z-10">
        {showLogout && (
          <button
            onClick={handleLogout}
            className="px-3 py-2 rounded-lg text-xs md:text-sm font-medium bg-gray-900 text-white hover:bg-black focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 shadow-md"
          >
            Logout
          </button>
        )}
      </div>
    </div>
  );
};

export default Header;
