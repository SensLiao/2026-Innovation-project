import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePatientDB } from "../useDB/usePatients";

const PatientProfilePage = () => {
  const { pid } = useParams();
  const navigate = useNavigate();
  const { currentPatient, fetchPatientByID, loading, error, setPatientData, updatePatient } = usePatientDB();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFields, setEditFields] = useState({
    name: '',
    age: '',
    gender: '',
    dateofbirth: '',
    phone: '',
    email: '',
    emergencycontactname: '',
    emergencycontactphone: '',
    streetaddress: '',
    suburb: '',
    state: '',
    postcode: '',
    country: '',
  });

  useEffect(() => {
    if (!currentPatient || String(currentPatient.pid) !== String(pid)) {
      fetchPatientByID(pid);
    } else if (!isEditing) {
      setEditFields({
        name: currentPatient.name || '',
        age: currentPatient.age ?? '',
        gender: currentPatient.gender || '',
        dateofbirth: currentPatient.dateofbirth || '',
        phone: currentPatient.phone || '',
        email: currentPatient.email || '',
        emergencycontactname: currentPatient.emergencycontactname || '',
        emergencycontactphone: currentPatient.emergencycontactphone || '',
        streetaddress: currentPatient.streetaddress || '',
        suburb: currentPatient.suburb || '',
        state: currentPatient.state || '',
        postcode: currentPatient.postcode || '',
        country: currentPatient.country || '',
      });
    }
  }, [pid, fetchPatientByID, currentPatient, isEditing]);

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!currentPatient) return <div className="p-8">No patient data found.</div>;

  const {
    profilephoto,
    name,
    age,
    dateofbirth,
    gender,
    phone,
    email,
    createdat,
    emergencycontactname,
    emergencycontactphone,
    streetaddress,
    suburb,
    state: patientState,
    postcode,
    country,
    pid: patientPid,
  } = currentPatient;

  return (
    <div className="min-h-screen bg-[#C2DCE7] flex justify-center items-start p-8 relative">
      {/* Success popup */}
      {showSuccess && (
        <div className="fixed top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          Update Successful
        </div>
      )}
      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-3xl relative">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white bg-opacity-60 flex items-center justify-center z-40 rounded-3xl">
            <div className="flex flex-col items-center">
              <svg className="animate-spin h-8 w-8 text-blue-500 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
              </svg>
              <span className="text-blue-500 font-semibold">Loading...</span>
            </div>
          </div>
        )}
        <button
          className="absolute top-6 right-6 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          onClick={() => navigate(-1)}
        >
          Back
        </button>
        <button
          className={`absolute top-6 left-6 px-4 py-2 rounded-lg ${isEditing ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
          disabled={loading}
          onClick={async () => {
            if (isEditing) {
              setPatientData({ ...currentPatient, ...editFields });
              await updatePatient(currentPatient.pid);
              setIsEditing(false);
              setShowSuccess(true);
              setTimeout(() => setShowSuccess(false), 2000);
            } else {
              setIsEditing(true);
            }
          }}
        >
          {isEditing ? 'Save' : 'Edit'}
        </button>
        {isEditing && (
          <button
            className="absolute top-6 left-28 px-4 py-2 rounded-lg bg-gray-300 hover:bg-gray-400"
            disabled={loading}
            onClick={() => {
              setIsEditing(false);
              setEditFields({
                name: currentPatient.name || '',
                age: currentPatient.age ?? '',
                gender: currentPatient.gender || '',
                dateofbirth: currentPatient.dateofbirth || '',
                phone: currentPatient.phone || '',
                email: currentPatient.email || '',
                emergencycontactname: currentPatient.emergencycontactname || '',
                emergencycontactphone: currentPatient.emergencycontactphone || '',
                streetaddress: currentPatient.streetaddress || '',
                suburb: currentPatient.suburb || '',
                state: currentPatient.state || '',
                postcode: currentPatient.postcode || '',
                country: currentPatient.country || '',
              });
            }}
          >
            Cancel
          </button>
        )}
        <div className="flex flex-col md:flex-row gap-8 mt-12">
          {/* Profile photo */}
          <div className="flex-shrink-0">
            {profilephoto ? (
              <img
                src={profilephoto}
                alt="Profile"
                className="w-32 h-32 rounded-full object-cover border-4 border-blue-200 shadow"
              />
            ) : (
              <div className="w-32 h-32 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 border-4 border-blue-200 shadow">
                No Photo
              </div>
            )}
          </div>
          {/* Info */}
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <div className="text-gray-500 text-xs">PID</div>
              <div className="font-bold text-lg">{patientPid || "—"}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Name</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input className="border rounded px-2 py-1 w-full" value={editFields.name} onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))} disabled={loading} />
                ) : (name || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Age</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input className="border rounded px-2 py-1 w-full" type="number" value={editFields.age} onChange={e => setEditFields(f => ({ ...f, age: e.target.value }))} disabled={loading} />
                ) : (age || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Gender</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <select className="border rounded px-2 py-1 w-full" value={editFields.gender} onChange={e => setEditFields(f => ({ ...f, gender: e.target.value }))} disabled={loading}>
                    <option value="">—</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                ) : (gender || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Date of Birth</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input
                    className="border rounded px-2 py-1 w-full"
                    type="date"
                    value={editFields.dateofbirth}
                    onChange={e => setEditFields(f => ({ ...f, dateofbirth: e.target.value }))}
                    disabled={loading}
                  />
                ) : (dateofbirth || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Registered</div>
              <div className="font-bold text-lg">{createdat ? new Date(createdat).toLocaleDateString() : "—"}</div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Phone</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input className="border rounded px-2 py-1 w-full" value={editFields.phone} onChange={e => setEditFields(f => ({ ...f, phone: e.target.value }))} disabled={loading} />
                ) : (phone || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Email</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input className="border rounded px-2 py-1 w-full" type="email" value={editFields.email} onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))} disabled={loading} />
                ) : (email || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Emergency Contact Name</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input className="border rounded px-2 py-1 w-full" value={editFields.emergencycontactname} onChange={e => setEditFields(f => ({ ...f, emergencycontactname: e.target.value }))} disabled={loading} />
                ) : (emergencycontactname || "—")}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-xs">Emergency Contact Phone</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <input className="border rounded px-2 py-1 w-full" value={editFields.emergencycontactphone} onChange={e => setEditFields(f => ({ ...f, emergencycontactphone: e.target.value }))} disabled={loading} />
                ) : (emergencycontactphone || "—")}
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="text-gray-500 text-xs">Address</div>
              <div className="font-bold text-lg">
                {isEditing ? (
                  <>
                    <input className="border rounded px-2 py-1 w-32 mr-2 mb-1" placeholder="Street" value={editFields.streetaddress} onChange={e => setEditFields(f => ({ ...f, streetaddress: e.target.value }))} disabled={loading} />
                    <input className="border rounded px-2 py-1 w-24 mr-2 mb-1" placeholder="Suburb" value={editFields.suburb} onChange={e => setEditFields(f => ({ ...f, suburb: e.target.value }))} disabled={loading} />
                    <input className="border rounded px-2 py-1 w-16 mr-2 mb-1" placeholder="State" value={editFields.state} onChange={e => setEditFields(f => ({ ...f, state: e.target.value }))} disabled={loading} />
                    <input className="border rounded px-2 py-1 w-16 mr-2 mb-1" placeholder="Postcode" value={editFields.postcode} onChange={e => setEditFields(f => ({ ...f, postcode: e.target.value }))} disabled={loading} />
                    <input className="border rounded px-2 py-1 w-24 mb-1" placeholder="Country" value={editFields.country} onChange={e => setEditFields(f => ({ ...f, country: e.target.value }))} disabled={loading} />
                  </>
                ) : (
                  [streetaddress, suburb, patientState, postcode, country].filter(Boolean).join(", ") || "—"
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientProfilePage;