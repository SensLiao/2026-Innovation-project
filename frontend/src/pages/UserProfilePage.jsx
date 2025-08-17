import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePubDB } from "../useDB/usePub";

const UserProfilePage = () => {
  const navigate = useNavigate();
  const { state: user } = useLocation();
  console.log("Navigation state:", user);
  const { publications, loading, error, fetchPublicationsByUid } = usePubDB();

  useEffect(() => {
    if (user && (user.UID || user.uid)) {
      fetchPublicationsByUid(user.UID || user.uid);
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow w-full max-w-md">
        <div className="flex flex-col items-center mb-6">
          <div className="w-32 h-32 rounded-full overflow-hidden mb-4 border-4 border-blue-200">
            {user.profilephoto ? (
              <img src={user.profilephoto} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">No Photo</div>
            )}
          </div>
          <h2 className="text-2xl font-bold mb-2">{user.Name || user.name || "User"}</h2>
          <p className="text-gray-500">{user.Email || user.email}</p>
        </div>
        <div className="space-y-2 text-sm mb-6">
          <div><strong>Phone:</strong> {user.Phone || user.phone || "—"}</div>
          <div><strong>Year of Experience:</strong> {user.YearOfExperience ?? user.yearofexperience ?? "—"}</div>
          <div><strong>Education:</strong> {user.Education || user.education || "—"}</div>
          <div><strong>Languages:</strong> {user.Languages || user.languages || "—"}</div>
          <div><strong>Created At:</strong> {user.CreatedAt || user.createdAt || "—"}</div>
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
};

export default UserProfilePage;
