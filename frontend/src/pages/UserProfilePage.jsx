import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePubDB } from "../useDB/usePub";
import { useUserDB } from "../useDB/useUsers";
import { useAuth } from "../useDB/useAuth";
import Decoration from '../assets/images/main2.png';
import Logo from "../assets/images/Logo.png";

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { user, fetchMe } = useAuth();
  // Local user state for display, to allow refresh after update

  const { publications, loading, error, fetchPublicationsByUid } = usePubDB();
  const { updateUser, setuserData, loading: userLoading } = useUserDB();
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
                        <div className="w-32 h-32 rounded-full overflow-hidden ring-4 ring-blue-100 mb-4">
                          {user.profilephoto ? (
                            <img src={user.profilephoto} alt="Profile" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">No Photo</div>
                          )}
                        </div>

                      {!isEditing ? (
                        <div className="flex flex-col gap-3">
                          <button className="h-10 w-32 bg-[#007AFF] text-white text-[11px] rounded-lg hover:bg-[#006CE0]">
                            Change Avatar
                          </button>
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
                              {user?.createdat ? new Date(user.createdat).toISOString().slice(0, 10) : "—"}
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

// Format date as YYYY-MM-DD
function formatDate(val) {
  if (!val) return "—";
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toISOString().slice(0, 10);
}


    //   <div className="bg-white p-8 rounded shadow w-full max-w-md relative">
    //     <div className="flex flex-col items-center mb-6">
    //       <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-blue-200">
    //         {user.profilephoto ? (
    //           <img src={user.profilephoto} alt="Profile" className="w-full h-full object-cover" />
    //         ) : (
    //           <div className="w-full h-full flex items-center justify-center text-gray-400">No Photo</div>
    //         )}
    //       </div>
    //       {isEditing ? (
    //         <>
    //           <input
    //             className="text-2xl font-bold mb-2 border-b border-gray-300 focus:outline-none focus:border-blue-400 text-center w-full"
    //             value={editFields.name}
    //             onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
    //           />
    //           <input
    //             className="text-gray-500 mb-2 border-b border-gray-300 focus:outline-none focus:border-blue-400 text-center w-full"
    //             value={editFields.email}
    //             onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))}
    //           />
    //         </>
    //       ) : (
    //         <>
    //           <h2 className="text-2xl font-bold mb-2">{user.name || "User"}</h2>
    //           <p className="text-gray-500">{user.email}</p>
    //         </>
    //       )}
    //     </div>
    //     <div className="space-y-2 text-sm mb-6">
    //       <div>
    //         <strong>Phone:</strong>{" "}
    //         {isEditing ? (
    //           <input
    //             className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-40"
    //             value={editFields.phone}
    //             onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))}
    //           />
    //         ) : (user.phone || "—")}
    //       </div>
    //       <div>
    //         <strong>Year of Experience:</strong>{" "}
    //         {isEditing ? (
    //           <input
    //             className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-20"
    //             type="number"
    //             value={editFields.yearofexperience}
    //             onChange={e => setEditFields(f => ({ ...f, yearofexperience: e.target.value }))}
    //           />
    //         ) : ( user.yearofexperience ?? "—")}
    //       </div>
    //       <div>
    //         <strong>Education:</strong>{" "}
    //         {isEditing ? (
    //           <input
    //             className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-40"
    //             value={editFields.education}
    //             onChange={e => setEditFields(f => ({ ...f, education: e.target.value }))}
    //           />
    //         ) : (user.education || "—")}
    //       </div>
    //       <div>
    //         <strong>Languages:</strong>{" "}
    //         {isEditing ? (
    //           <input
    //             className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-40"
    //             value={editFields.languages}
    //             onChange={e => setEditFields(f => ({ ...f, languages: e.target.value }))}
    //           />
    //         ) : ( user.languages || "—")}
    //       </div>
    //       <div><strong>Created At:</strong> {formatDate(user.createdat)}</div>
    //     </div>
    //     {/* Edit/Save/Cancel buttons */}
    //     <div className="flex gap-3 mb-6">
    //       {isEditing ? (
    //         <>
    //           <button
    //             className="px-4 py-2 bg-green-500 text-white rounded"
    //             onClick={async () => {
    //               // Ensure yearofexperience is always a string (not number) for backend
    //               let yoe = editFields.yearofexperience;
    //               if (yoe === null || yoe === undefined) yoe = "";
    //               yoe = String(yoe);
    //               console.log(editFields.yearofexperience)
    //               setuserData({
    //                 name: editFields.name,
    //                 email: editFields.email,
    //                 phone: editFields.phone,
    //                 yearofexperience: yoe,
    //                 education: editFields.education,
    //                 languages: editFields.languages,
    //                 profilephoto: editFields.profilephoto,
    //               });
    //               await updateUser(user.uid);
    //               await fetchMe(); // Refresh auth user info

    //               // Update editFields with latest value from localUser after update
    //               setEditFields(prev => ({
    //                 ...prev,
    //                 yearofexperience: yoe
    //               }));
    //               setIsEditing(false);
    //               setShowSuccess(true);
    //               setTimeout(() => setShowSuccess(false), 2000);
    //             }}
    //             disabled={userLoading}
    //           >
    //             Save
    //           </button>
    //           <button
    //             className="px-4 py-2 bg-gray-400 text-white rounded"
    //             onClick={() => {
    //               setIsEditing(false);
    //               setEditFields({
    //                 name: user.name || "",
    //                 email: user.email || "",
    //                 phone: user.phone || "",
    //                 yearofexperience: user.yearofexperience ?? "",
    //                 education: user.education || "",
    //                 languages: user.languages || "",
    //                 profilephoto: user.profilephoto || "",
    //               });
    //             }}
    //             disabled={userLoading}
    //           >
    //             Cancel
    //           </button>
    //         </>
    //       ) : (
    //         <button
    //           className="px-4 py-2 bg-blue-500 text-white rounded"
    //           onClick={() => setIsEditing(true)}
    //         >
    //           Edit
    //         </button>

    //       )}
    //     </div>
    //     <div className="mb-6">
    //       <h3 className="text-lg font-semibold mb-2">Publications</h3>
    //       {loading && <div>Loading publications...</div>}
    //       {error && <div className="text-red-500">Error: {error}</div>}
    //       {!loading && !error && publications.length === 0 && <div>No publications found.</div>}
    //       {!loading && !error && publications.length > 0 && (
    //         <ul className="list-disc pl-5 space-y-1">
    //           {publications.map((pub) => (
    //             <li key={pub.PID || pub.pid}>
    //               <div className="font-medium">{pub.Title || pub.title}</div>
    //               <div className="text-xs text-gray-500">{pub.PublicationDate || pub.publicationdate || "—"}</div>
    //               <div className="text-xs">{pub.Description || pub.description || ""}</div>
    //               {pub.Link && (
    //                 <a href={pub.Link} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline text-xs">View Publication</a>
    //               )}
    //             </li>
    //           ))}
    //         </ul>
    //       )}
    //     </div>
    //     <button onClick={() => navigate(-1)} className="mt-6 px-4 py-2 bg-blue-500 text-white rounded">Back</button>
    //   </div>
    // </div>