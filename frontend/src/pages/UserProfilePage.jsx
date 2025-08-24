import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePubDB } from "../useDB/usePub";
import { useUserDB } from "../useDB/useUsers";

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { state: user } = useLocation();
  console.log("Navigation state:", user);
  const { publications, loading, error, fetchPublicationsByUid } = usePubDB();
  const { updateUser, setuserData, userData, loading: userLoading, fetchUsers, users } = useUserDB();
  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    name: user?.Name || user?.name || "",
    email: user?.Email || user?.email || "",
    phone: user?.Phone || user?.phone || "",
    yearofexperience: user?.YearOfExperience ?? user?.yearofexperience ?? "",
    education: user?.Education || user?.education || "",
    languages: user?.Languages || user?.languages || "",
    passwordhash: user?.passwordhash || "",
    profilephoto: user?.profilephoto || "",
  });
  const [showSuccess, setShowSuccess] = useState(false);

  // Local user state for display, to allow refresh after update
  const [localUser, setLocalUser] = useState(user);

  useEffect(() => {
    if (user && (user.UID || user.uid)) {
      fetchPublicationsByUid(user.UID || user.uid);
    }
  }, [user, fetchPublicationsByUid]);

  // After update, fetch latest user info from users list
  useEffect(() => {
    if (users && (user?.UID || user?.uid)) {
      const updated = users.find(u => (u.uid || u.UID) === (user.uid || user.UID));
      if (updated) setLocalUser(updated);
    }
  }, [users, user]);

  if (!localUser || Object.keys(localUser).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded shadow text-center">
          <p>No user information found.</p>
          <button onClick={() => navigate(-1)} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 relative">
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
      <div className="bg-white p-8 rounded shadow w-full max-w-md relative">
        <div className="flex flex-col items-center mb-6">
          <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-blue-200">
            {localUser.profilephoto ? (
              <img src={localUser.profilephoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Photo</div>
            )}
          </div>
          {isEditing ? (
            <>
              <input
                className="text-2xl font-bold mb-2 border-b border-gray-300 focus:outline-none focus:border-blue-400 text-center w-full"
                value={editFields.name}
                onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
              />
              <input
                className="text-gray-500 mb-2 border-b border-gray-300 focus:outline-none focus:border-blue-400 text-center w-full"
                value={editFields.email}
                onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))}
              />
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-2">{localUser.Name || localUser.name || "User"}</h2>
              <p className="text-gray-500">{localUser.Email || localUser.email}</p>
            </>
          )}
        </div>
        <div className="space-y-2 text-sm mb-6">
          <div>
            <strong>Phone:</strong>{" "}
            {isEditing ? (
              <input
                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-40"
                value={editFields.phone}
                onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))}
              />
            ) : (localUser.Phone || localUser.phone || "—")}
          </div>
          <div>
            <strong>Year of Experience:</strong>{" "}
            {isEditing ? (
              <input
                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-20"
                type="number"
                value={editFields.yearofexperience}
                onChange={e => setEditFields(f => ({ ...f, yearofexperience: e.target.value }))}
              />
            ) : (localUser.YearOfExperience ?? localUser.yearofexperience ?? "—")}
          </div>
          <div>
            <strong>Education:</strong>{" "}
            {isEditing ? (
              <input
                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-40"
                value={editFields.education}
                onChange={e => setEditFields(f => ({ ...f, education: e.target.value }))}
              />
            ) : (localUser.Education || localUser.education || "—")}
          </div>
          <div>
            <strong>Languages:</strong>{" "}
            {isEditing ? (
              <input
                className="border-b border-gray-300 focus:outline-none focus:border-blue-400 w-40"
                value={editFields.languages}
                onChange={e => setEditFields(f => ({ ...f, languages: e.target.value }))}
              />
            ) : (localUser.Languages || localUser.languages || "—")}
          </div>
          <div><strong>Created At:</strong> {formatDate(localUser.CreatedAt || localUser.createdat)}</div>
        </div>
        {/* Edit/Save/Cancel buttons */}
        <div className="flex gap-3 mb-6">
          {isEditing ? (
            <>
              <button
                className="px-4 py-2 bg-green-500 text-white rounded"
                onClick={async () => {
                  // Ensure yearofexperience is always a string (not number) for backend
                  let yoe = editFields.yearofexperience;
                  if (yoe === null || yoe === undefined) yoe = "";
                  yoe = String(yoe);
                  console.log(editFields.yearofexperience)
                  setuserData({
                    name: editFields.name,
                    email: editFields.email,
                    phone: editFields.phone,
                    yearofexperience: yoe,
                    education: editFields.education,
                    languages: editFields.languages,
                    passwordhash: editFields.passwordhash,
                    profilephoto: editFields.profilephoto,
                  });
                  await updateUser(user.UID || user.uid);
                  await fetchUsers(); // Refresh users list
                  // Update editFields with latest value from localUser after update
                  setEditFields(prev => ({
                    ...prev,
                    yearofexperience: yoe
                  }));
                  setIsEditing(false);
                  setShowSuccess(true);
                  setTimeout(() => setShowSuccess(false), 2000);
                }}
                disabled={userLoading}
              >
                Save
              </button>
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded"
                onClick={() => {
                  setIsEditing(false);
                  setEditFields({
                    name: localUser.Name || localUser.name || "",
                    email: localUser.Email || localUser.email || "",
                    phone: localUser.Phone || localUser.phone || "",
                    yearofexperience: localUser.YearOfExperience ?? localUser.yearofexperience ?? "",
                    education: localUser.Education || localUser.education || "",
                    languages: localUser.Languages || localUser.languages || "",
                    passwordhash: localUser.passwordhash || "",
                    profilephoto: localUser.profilephoto || "",
                  });
                }}
                disabled={userLoading}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded"
              onClick={() => setIsEditing(true)}
            >
              Edit
            </button>

          )}
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
        <button onClick={() => navigate(-1)} className="mt-6 px-4 py-2 bg-blue-500 text-white rounded">Back</button>
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
