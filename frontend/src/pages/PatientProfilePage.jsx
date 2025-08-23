import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePatientDB } from "../useDB/usePatients";
import Logo from "../assets/images/Logo.png";
import { Edit, Trash2 } from "lucide-react";
import { toDDMMYYYY } from "../components/Header";


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
    <div className="min-h-screen bg-[#C2DCE7] p-6 md:p-10 flex justify-center">
      
      {/* Success popup */}
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50">
          Update Successful
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-3xl relative">

        {/*---------------------------------------- Header Section ------------------------------------- */}
        <div className="flex justify-between items-center border-b pb-3 mb-6 relative">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="text-2xl leading-none"
              aria-label="Go back"
              title="Go back"
            >
              ←
            </button>
            Patient Profile
          </h2>

          {/*--------------------------------------------- Logo -------------------------------------*/}
          <img src={Logo} 
            alt="Logo" 
            className="w-[100px] object-contain absolute right-10 top-7 -translate-y-1/2 pointer-events-none select-none" 
          />
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left (2/3) */}
          <div className="col-span-2">
            
            {/* Patient Info Card */}
            <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              {/*------------------------------------Patient Profile Photo --------------------------------------*/}
              {profilephoto ? (
                <img
                  src={profilephoto}
                  alt="Profile"
                  className="w-32 h-32 rounded-lg object-cover border-4 border-blue-200 shadow"
                />
              ) : (
                <div className="w-32 h-32 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border-4 border-blue-200 shadow">
                  No Photo
                </div>
              )}

              {/* ------------------------------------Buttons under profile ------------------------------*/}
              {/* Edit / Delete Buttons */}
              <div className="flex justify-center gap-4 w-32 mt-2">
                <button className="p-2 bg-gray-200 hover:bg-gray-300 rounded" aria-label="Edit" title="Edit">
                  <Edit className="w-5 h-5 text-gray-700" />
                </button>
                <button className="p-2 bg-red-100 hover:bg-red-200 rounded" aria-label="Delete" title="Delete">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </button>
              </div>

              {/* Segmentation Button */}
              <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded w-32 mt-4">
                Segmentation
              </button>
            </div> 

            {/* ---------------------------------Wrapper for text sections (aligned with photo) ----------------------- */}
            <div className="ml-[10px] space-y-8">

              {/* Patient Information */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  Patient Information
                  <span className="border-b border-gray-200 w-24" />
                </h3>

                <div className="grid grid-cols-[auto,1fr] gap-y-3 gap-x-4 mt-2">
                  <label className="text-sm text-gray-600 flex items-center">Name</label>
                  <input value={name || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Patient ID</label>
                  <input value={patientPid ?? ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Gender</label>
                  <input value={gender || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Date of Birth</label>
                  <input value={toDDMMYYYY(dateofbirth)} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Register Date</label>
                  <input value={toDDMMYYYY(createdat)} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                </div>
              </div>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  Emergency Contact
                  <span className="border-b border-gray-200 w-24" />
                </h3>

                <div className="grid grid-cols-[auto,1fr] gap-y-3 gap-x-4 mt-2">
                  <label className="text-sm text-gray-600 flex items-center">Name</label>
                  <input value={emergencycontactname || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Phone</label>
                  <input value={emergencycontactphone || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  Address
                  <span className="border-b border-gray-200 w-48" /> 
                </h3>

                <div className="grid grid-cols-[auto,1fr] gap-y-3 gap-x-4 mt-2">
                  <label className="text-sm text-gray-600 flex items-center">Street</label>
                  <input value={streetaddress || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Suburb</label>
                  <input value={suburb || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">State</label>
                  <input value={patientState || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Postcode</label>
                  <input value={postcode || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Country</label>
                  <input value={country || ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                </div>
              </div>
            </div>

          {/* --------------------------- Record  ----------------------- */}
          {/* --------------------------- Trend  ----------------------- */}
          </div>
        </div>
      </div>
    </div>
  </div>
      
  );
};

export default PatientProfilePage;