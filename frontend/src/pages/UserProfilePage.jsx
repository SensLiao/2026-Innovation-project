import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePubStore } from "../stores/usePubStore";
import { useUserStore } from "../stores/useUserStore";
import { useAuthStore } from "../stores/useAuthStore";
import Decoration from '../assets/images/main2.png';
import Logo from "../assets/images/Logo.png";

// ------- Convert UTC timestamp to local time and format as DD/MM/YYYY HH:MM -------
export const toDDMMYYYYHHMM = (value) => {
  if (!value) return "—";
  // Handle Firestore timestamps
  if (value?.toDate) value = value.toDate();
  if (value?.seconds) value = new Date(value.seconds * 1000);
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
};

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, fetchMe } = useAuthStore();
  // Local user state for display, to allow refresh after update

  const { publications, loading, error, fetchPublicationsByUid } = usePubStore();
  const { updateUser, setuserData, loading: userLoading } = useUserStore();
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    name: user?.Name || user?.name || "",
    email: user?.Email || user?.email || "",
    phone: user?.Phone || user?.phone || "",
    yearofexperience: user?.YearOfExperience ?? user?.yearofexperience ?? "",
    education: user?.Education || user?.education || "",
    languages: user?.Languages || user?.languages || "",
    profilephoto: user?.profilephoto || "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Profile upload state and helpers
  const [profileUploading, setProfileUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const compressImageToDataUrl = (file, maxWidth = 1024, quality = 0.8) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      alert('Only JPG and PNG files are allowed');
      e.target.value = '';
      return;
    }

    const MAX_RAW_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_RAW_SIZE) {
      alert('File too large (max 5MB)');
      e.target.value = '';
      return;
    }

    setProfileUploading(true);
    try {
      let dataUrl;
      if (file.size > 500 * 1024) {
        dataUrl = await compressImageToDataUrl(file, 1024, 0.8);
      } else {
        dataUrl = await fileToDataUrl(file);
      }

      // Immediate UI feedback
      setuserData({ ...user, profilephoto: dataUrl });
      setEditFields(prev => ({ ...prev, profilephoto: dataUrl }));

      // Persist and refresh auth user
      await updateUser(user.uid);
      await fetchMe();

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1200);
    } catch (err) {
      console.error('Error uploading avatar:', err);
      alert('Failed to upload avatar: ' + (err.message || 'Unknown'));
    } finally {
      e.target.value = '';
      setProfileUploading(false);
    }
  };

  // 首次进入没 user 时拉一次，会自动带上 cookie
  useEffect(() => {
    if (!user) fetchMe();
  }, [user, fetchMe]);

  useEffect(() => {
    if (user && user.uid ) {
      fetchPublicationsByUid(user.uid);
    }
  }, [user, fetchPublicationsByUid]);

  if (!user || Object.keys(user).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow text-center">
          <p>No user information found.</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Go Back</button>
        </div>
      </div>
    );
  }

  // Handlers for Edit/Save/Cancel — same behavior as old code
  const handleEdit = () => setIsEditing(true);

  // Handlers
  const handleSave = async () => {
    try {
      // 1) Make sure yoe is a string (matches your server)
      let yoe = editFields.yearofexperience;
      if (yoe === null || yoe === undefined) yoe = "";
      yoe = String(yoe);

      // 2) Stage data in the userDB store (same as old code)
      setuserData({
        name: (editFields.name ?? "").trim(),
        email: (editFields.email ?? "").trim(),
        phone: (editFields.phone ?? "").trim(),
        yearofexperience: yoe,                 // string
        education: (editFields.education ?? "").trim(),
        languages: (editFields.languages ?? "").trim(),
        profilephoto: editFields.profilephoto ?? "",
      });

      // 3) Call update with uid only (hook reads staged data)
      await updateUser(user.uid);

      // 4) refresh & clean up
      await fetchMe();
      setEditFields((p) => ({ ...p, yearofexperience: yoe }));
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (e) {
      console.error("Error updating user:", e?.response?.status, e?.response?.data || e);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditFields({
      name: user.name || "",
      email: user.email || "",
      phone: user.phone || "",
      yearofexperience: user.yearofexperience ?? "",
      education: user.education || "",
      languages: user.languages || "",
      profilephoto: user.profilephoto || "",
    });
  };


    
  return (

    <div className="min-h-screen bg-[#cfe0e8]/60">
      
      {/* Loading overlay */}
      {userLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-20">
          <div className="loader border-4 border-blue-200 border-t-blue-500 rounded-full w-12 h-12 animate-spin mr-4" />
          <span className="text-blue-700 font-semibold">Updating...</span>
        </div>
      )}

      {/* Success popup */}
      {showSuccess && (
        <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-green-100 border border-green-400 text-green-700 px-6 py-3 rounded shadow z-30">
          Update Successful
        </div>
      )}

      {/* Top app bar */}
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
                  <div className="bg-white shadow-2xl p-8 relative w-full overflow-hidden min-h-[75vh] md:min-h-[80vh] pb-20">
                  
                  {/* <div className="bg-white shadow-2xl p-8 relative w-full pb-10"> */}

                    {/*---------------------------------------- Header Section ------------------------------------- */}
                    <img src={Logo} 
                        alt="Logo" 
                        className="w-[170px] object-contain absolute right-0 top-9 -translate-y-1/2 pointer-events-none select-none" 
                    />

                    {/* Back button */}
                    <div className="flex items-center gap-3">
                      <button
                      onClick={() => navigate('/patient')}
                      className="absolute left-4 inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-slate-100"
                      aria-label="Go back"
                      >
                      <span className="text-2xl font-bold text-[#344054]">←</span>
                      </button>
                      <h1 className="text-lg font-semibold text-slate-800 ml-10">User Profile</h1>
                    </div>

                    {/* header line */}
                    <hr className="border-t border-slate-200 mt-3" />

                    {/*---------------------------------------- left Section ------------------------------------- */}
                    <div className="mt-6 grid grid-cols-[260px_1fr] gap-12 items-start">

                      {/* Left column: avatar + buttons */}
                      <div className="flex flex-col items-start">
                        <div className="relative">
                          <input
                            id="avatar-input"
                            type="file"
                            accept="image/png, image/jpeg"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            className="hidden"
                          />

                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={userLoading || profileUploading}
                            className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-blue-100 mb-4 p-0 bg-transparent flex items-center justify-center"
                            title="Click to change avatar"
                          >
                            {user.profilephoto ? (
                              <img src={user.profilephoto} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-400">No Photo</div>
                            )}
                          </button>

                          {profileUploading && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="bg-white/80 px-2 py-1 rounded">Uploading...</div>
                            </div>
                          )}
                        </div>

                      {!isEditing ? (
                        <div className="flex flex-col gap-3">
                          <button className="h-10 w-32 bg-[#007AFF] text-white text-[11px] rounded-lg hover:bg-[#006CE0]">
                            Change Password
                          </button>
                          <button
                            className="h-10 w-32 bg-[#007AFF] text-white text-[11px] rounded-lg hover:bg-[#006CE0]"
                            onClick={() => setIsEditing(true)}
                          >
                            Edit Profile
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-3 w-full mt-2">
                          <button
                            className="flex-1 h-10 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            disabled={userLoading}
                            onClick={handleSave}
                          >
                            Save
                          </button>
                          <button
                            className="flex-1 h-10 bg-gray-400 text-white rounded-lg hover:bg-gray-500 disabled:opacity-50"
                            disabled={userLoading}
                            onClick={handleCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                      </div>

                      {/*---------------------------------------- Right Section ------------------------------------- */}
                      <div className="max-w-[700px]">

                      {/* Title */}
                      <div className="flex items-center gap-5 mb-6">
                        <h2 className="text-lg font-semibold text-slate-800 whitespace-nowrap">
                          Dr. {user?.name?.split(" ")?.slice(-1) ?? "User"}
                        </h2>
                        <div className="border-b border-slate-300/70 flex-1" />
                      </div>

                      {/* Profile Fields */}
                      <div className="space-y-4 text-sm text-slate-800">

                        {/* Name */}
                        <div className="flex items-center gap-8 py-1">
                          <span className="text-slate-600 whitespace-nowrap w-28">Name:</span>
                          {isEditing ? (
                            <input
                              className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-64"
                              value={editFields.name}
                              onChange={(e) => setEditFields(f => ({ ...f, name: e.target.value }))}
                            />
                          ) : (
                            <span className="text-slate-700 w-64">{user?.name ?? "—"}</span>
                          )}
                        </div>

                        {/* Email */}
                        <div className="flex items-center gap-8 py-1">
                          <span className="text-slate-600 whitespace-nowrap w-28">Email:</span>
                          {isEditing ? (
                            <input
                              type="email"
                              className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-64"
                              value={editFields.email}
                              onChange={(e) => setEditFields(f => ({ ...f, email: e.target.value }))}
                            />
                          ) : (
                            <span className="text-slate-700 w-64">{user?.email ?? "—"}</span>
                          )}
                        </div>

                        {/* Phone */}
                        <div className="flex items-center gap-8 py-1">
                          <span className="text-slate-600 whitespace-nowrap w-28">Phone:</span>
                          {isEditing ? (
                            <input
                              className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-64"
                              value={editFields.phone}
                              onChange={(e) => setEditFields(f => ({ ...f, phone: e.target.value }))}
                            />
                          ) : (
                            <span className="text-slate-700 w-64">{user?.phone ?? "—"}</span>
                          )}
                        </div>

                      </div>

                      {/* Professional Details */}
                      <div className="mt-10">
                        <div className="flex items-center gap-5 mb-6">
                          <h2 className="text-lg font-semibold text-slate-800 whitespace-nowrap">
                            Professional Details
                          </h2>
                          <div className="border-b border-slate-300/70 flex-1" />
                        </div>

                        <div className="space-y-4 text-sm text-slate-800">

                          {/* Experience */}
                          <div className="flex items-center gap-8 py-1">
                            <span className="text-slate-600 whitespace-nowrap w-28">Experience:</span>
                            {isEditing ? (
                              <input
                                type="number"
                                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-20"
                                value={editFields.yearofexperience}
                                onChange={(e) => setEditFields(f => ({ ...f, yearofexperience: e.target.value }))}
                              />
                            ) : (
                              <span className="text-slate-700 w-64">
                                {user?.yearofexperience ?? "—"} Years
                              </span>
                            )}
                          </div>

                          {/* Education */}
                          <div className="flex items-center gap-8 py-1">
                            <span className="text-slate-600 whitespace-nowrap w-28">Education:</span>
                            {isEditing ? (
                              <input
                                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-64"
                                value={editFields.education}
                                onChange={(e) => setEditFields(f => ({ ...f, education: e.target.value }))}
                              />
                            ) : (
                              <span className="text-slate-700 w-64">{user?.education ?? "—"}</span>
                            )}
                          </div>

                          {/* Languages */}
                          <div className="flex items-center gap-8 py-1">
                            <span className="text-slate-600 whitespace-nowrap w-28">Languages:</span>
                            {isEditing ? (
                              <input
                                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-64"
                                value={editFields.languages}
                                onChange={(e) => setEditFields(f => ({ ...f, languages: e.target.value }))}
                              />
                            ) : (
                              <span className="text-slate-700 w-64">{user?.languages ?? "—"}</span>
                            )}
                          </div>

                          {/* Created At */}
                          <div className="flex items-center gap-8 py-1">
                            <span className="text-slate-600 whitespace-nowrap w-28">Created At:</span>
                            <span className="text-slate-700 w-64">
                              {user?.createdat ? toDDMMYYYYHHMM(user.createdat) : "—"}
                            </span>
                          </div>

                        </div>
                      </div>

                      {/* Publication Section */}
                      <div className="mt-14">
                        
                        <div className="flex items-center gap-5 mb-6">
                          <h2 className="text-lg font-semibold text-slate-800 whitespace-nowrap">
                            Publication
                          </h2>
                          <div className="border-b border-slate-300/70 flex-1" />
                        </div>

                        <div className="mb-6">
                          <h3 className="text-lg font-semibold mb-2">Publications</h3>
                          {loading && <div>Loading publications...</div>}
                          {error && <div className="text-red-500">Error: {error}</div>}
                          {!loading && !error && publications.length === 0 && <div>No publications found.</div>}
                          {!loading && !error && publications.length > 0 && (
                            <ul className="list-disc pl-5 space-y-1">
                              {publications.map((pub) => (
                                <li key={pub.PID || pub.pid}>
                                  <div className="font-medium">{pub.Title || pub.title}</div>
                                  <div className="text-xs text-gray-500">{pub.PublicationDate || pub.publicationdate || "—"}</div>
                                  <div className="text-xs">{pub.Description || pub.description || ""}</div>
                                  {pub.Link && (
                                    <a href={pub.Link} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">View Publication</a>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
}

export default UserProfilePage;

