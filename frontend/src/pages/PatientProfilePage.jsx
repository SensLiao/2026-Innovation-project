import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePatientDB } from "../useDB/usePatients";
import Logo from "../assets/images/Logo.png";
import { Edit, Trash2 } from "lucide-react";
import { toDDMMYYYY } from "../components/Header";


const PatientProfilePage = () => {
  const { pid } = useParams();
  const navigate = useNavigate();

  const {
    currentPatient,
    fetchPatientByID,
    setPatientData,
    updatePatient,
    deletePatient,
    error,
  } = usePatientDB();

  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ----------- local form data -----------
  const [editFields, setEditFields] = useState({
    name: "",
    age: "",
    gender: "",
    dateofbirth: "",
    phone: "",
    email: "",
    emergencycontactname: "",
    emergencycontactphone: "",
    streetaddress: "",
    suburb: "",
    state: "",
    postcode: "",
    country: "",
  });

  // Convert Firestore timestamp → yyyy-mm-dd for <input type="date">
  const toISO = (v) => {
    if (!v) return "";
    if (v.seconds) return new Date(v.seconds * 1000).toISOString().slice(0, 10);
    if (typeof v === "string" && v.includes("T"))
      return new Date(v).toISOString().slice(0, 10);
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    return v;
  };

  // Convert Firestore → dd/mm/yyyy for display
  const toDisplay = (v) => {
    if (!v) return "";
    if (v.seconds) return toDDMMYYYY(new Date(v.seconds * 1000));
    if (typeof v === "string" && v.includes("T"))
      return toDDMMYYYY(new Date(v));
    if (v instanceof Date) return toDDMMYYYY(v);
    return v;
  };

  // Load patient data from Firestore
  useEffect(() => {
    if (!currentPatient || String(currentPatient.pid) !== String(pid)) {
      fetchPatientByID(pid);
    } else if (!isEditing) {
      // load editable values
      setEditFields({
        name: currentPatient.name || "",
        age: currentPatient.age ?? "",
        gender: currentPatient.gender || "",
        dateofbirth: toISO(currentPatient.dateofbirth),
        phone: currentPatient.phone || "",
        email: currentPatient.email || "",
        emergencycontactname: currentPatient.emergencycontactname || "",
        emergencycontactphone: currentPatient.emergencycontactphone || "",
        streetaddress: currentPatient.streetaddress || "",
        suburb: currentPatient.suburb || "",
        state: currentPatient.state || "",
        postcode: currentPatient.postcode || "",
        country: currentPatient.country || "",
      });
    }
  }, [pid, currentPatient, fetchPatientByID, isEditing]);

  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!currentPatient) return <div className="p-8">Loading...</div>;

  // helper for inputs
  const makeInput = (label, key, readonly, formatter) => (
    <>
      <label className="text-sm text-gray-600">{label}</label>
      <input
        value={
          isEditing && !readonly
            ? editFields[key]
            : formatter
            ? formatter(currentPatient[key])
            : currentPatient[key] || ""
        }
        readOnly={!isEditing || readonly}
        onChange={(e) =>
          isEditing &&
          !readonly &&
          setEditFields((f) => ({ ...f, [key]: e.target.value }))
        }
        className={`w-full border rounded-lg px-3 py-1 text-sm ${
          !isEditing || readonly
            ? "bg-gray-100 border-gray-200"
            : "bg-white border-blue-400"
        }`}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-[#C2DCE7] py-10">

      {/* Success popup */}
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 px-6 py-3 bg-green-500 text-white rounded-lg shadow-lg">
          Update Successful
        </div>
      )}

      <div className="w-[90%] max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl p-10 relative">

        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-8">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-3xl">←</button>
            Patient Profile
          </h1>
          <img src={Logo} alt="Logo" className="w-[160px]" />
        </div>

        <div className="grid grid-cols-3 gap-10">

          {/* LEFT: PHOTO + ACTIONS */}
          <div>
            <div className="w-36 h-36 bg-gray-200 rounded-lg flex items-center justify-center border-4 border-blue-200">
              {currentPatient.profilephoto ? (
                <img
                  src={currentPatient.profilephoto}
                  alt="Profile"
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-gray-500">No Photo</span>
              )}
            </div>

            <div className="flex gap-3 mt-4">

              {/* EDIT */}
              {!isEditing && (
                <button
                  className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="text-gray-700 w-5 h-5" />
                </button>
              )}

              {/* SAVE — SAME METHOD AS PATIENT PAGE */}
              {isEditing && (
                <button
                  className="p-2 bg-green-200 rounded hover:bg-green-300 text-green-800"
                  onClick={async () => {
                    const updated = {
                      ...currentPatient,
                      ...editFields,
                      age: Number(editFields.age),
                    };

                    // EXACT SAME METHOD as PatientPage
                    setPatientData(updated);
                    await updatePatient(pid);

                    setIsEditing(false);
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 2000);

                    fetchPatientByID(pid);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              )}

              {/* CANCEL */}
              {isEditing && (
                <button
                  className="p-2 bg-gray-200 rounded hover:bg-gray-300"
                  onClick={() => setIsEditing(false)}
                >
                  <svg viewBox="0 0 24 24" width="20" height="20">
                    <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="2" />
                  </svg>
                </button>
              )}

              {/* DELETE */}
              {!isEditing && (
                <button
                  className="p-2 bg-red-200 rounded hover:bg-red-300"
                  onClick={async () => {
                    if (!window.confirm("Delete this patient?")) return;
                    await deletePatient(pid);
                    navigate("/patient");
                  }}
                >
                  <Trash2 className="text-red-700 w-5 h-5" />
                </button>
              )}
            </div>

            <button className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg flex items-center justify-center">
              Segmentation
            </button>

          </div>

          {/* RIGHT: FORM FIELDS */}
          <div className="col-span-2 space-y-10">

            {/* PATIENT INFO */}
            <section>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
                Patient Information
                <div className="border-b flex-1"></div>
              </h2>

              <div className="grid grid-cols-[130px,1fr] gap-y-4 gap-x-4">
                {makeInput("Name", "name")}
                {makeInput("Patient ID", "pid", true)}
                {makeInput("Gender", "gender")}

                {/* DOB with Date Picker */}
                <>
                  <label className="text-sm text-gray-600">Date of Birth</label>
                  {!isEditing ? (
                    <input
                      value={toDisplay(currentPatient.dateofbirth)}
                      readOnly
                      className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-1 text-sm"
                    />
                  ) : (
                    <input
                      type="date"
                      value={editFields.dateofbirth}
                      onChange={(e) =>
                        setEditFields((f) => ({ ...f, dateofbirth: e.target.value }))
                      }
                      className="w-full border border-blue-400 rounded-lg px-3 py-1 text-sm bg-white"
                    />
                  )}
                </>

                {makeInput("Register Date", "createdat", true, toDisplay)}
              </div>
            </section>

            {/* EMERGENCY CONTACT */}
            <section>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
                Emergency Contact
                <div className="border-b flex-1"></div>
              </h2>

              <div className="grid grid-cols-[130px,1fr] gap-y-4 gap-x-4">
                {makeInput("Name", "emergencycontactname")}
                {makeInput("Phone", "emergencycontactphone")}
              </div>
            </section>

            {/* ADDRESS */}
            <section>
              <h2 className="text-xl font-bold mb-3 flex items-center gap-3">
                Address
                <div className="border-b flex-1"></div>
              </h2>

              <div className="grid grid-cols-[130px,1fr] gap-y-4 gap-x-4">
                {makeInput("Street", "streetaddress")}
                {makeInput("Suburb", "suburb")}
                {makeInput("State", "state")}
                {makeInput("Postcode", "postcode")}
                {makeInput("Country", "country")}
              </div>
            </section>

          </div>
        </div>

      </div>
    </div>
  );
};

export default PatientProfilePage;
