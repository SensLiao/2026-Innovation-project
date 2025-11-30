import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePatientDB } from "../useDB/usePatients";
import Logo from "../assets/images/Logo.png";
import { Edit, Trash2 } from "lucide-react";
import { toDDMMYYYY } from "../components/Header";
import Sample1 from "../assets/images/Sample1.png";

const PatientProfilePage = () => {
  const { pid } = useParams();
  const navigate = useNavigate();

  const {
    currentPatient,
    fetchPatientByID,
    setPatientData,
    updatePatient,
    deletePatient,
  } = usePatientDB();

  const [isEditing, setIsEditing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Editable fields
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

  // Sample placeholder CT & Report data
  const ctData = [
    { id: 1, type: "PDF", date: "12/05/2025" },
    { id: 2, type: "PDF", date: "12/05/2025" },
    { id: 3, type: "PDF", date: "12/05/2025" },
  ];

  const reportData = [
    { id: 1, type: "PDF", date: "12/05/2025" },
    { id: 2, type: "PDF", date: "12/05/2025" },
    { id: 3, type: "PDF", date: "12/05/2025" },
  ];

  const toISO = (v) => {
    if (!v) return "";
    if (v.seconds) return new Date(v.seconds * 1000).toISOString().slice(0, 10);
    if (typeof v === "string" && v.includes("T"))
      return new Date(v).toISOString().slice(0, 10);
    return v;
  };

  const toDisplay = (v) => {
    if (!v) return "";
    if (v.seconds) return toDDMMYYYY(new Date(v.seconds * 1000));
    if (typeof v === "string" && v.includes("T"))
      return toDDMMYYYY(new Date(v));
    return v;
  };

  useEffect(() => {
    if (!currentPatient || String(currentPatient.pid) !== String(pid)) {
      fetchPatientByID(pid);
    } else if (!isEditing) {
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
  }, [pid, currentPatient, isEditing, fetchPatientByID]);

  if (!currentPatient) return <div className="p-8">Loading...</div>;

  const makeInput = (label, key, readonly = false, formatter = null) => (
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

      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          Update Successful
        </div>
      )}

      <div className="w-[90%] max-w-6xl mx-auto bg-white rounded-3xl shadow-2xl p-10">

        {/* Header */}
        <div className="flex justify-between items-center border-b pb-4 mb-8">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="text-3xl">←</button>
            Patient Profile
          </h1>
          <img src={Logo} alt="Logo" className="w-[150px]" />
        </div>

        <div className="grid grid-cols-3 gap-10">

          {/* LEFT COLUMN */}
          <div className="space-y-6">

            {/* Photo */}
            <div className="w-36 h-36 bg-gray-200 rounded-lg border-4 border-blue-200 flex items-center justify-center">
              {currentPatient.profilephoto ? (
                <img
                  src={currentPatient.profilephoto}
                  className="w-full h-full object-cover rounded-lg"
                />
              ) : (
                <span className="text-gray-500">No Photo</span>
              )}
            </div>

            {/* Edit/Delete */}
            <div className="flex gap-3">
              {!isEditing && (
                <button
                  className="p-2 bg-gray-200 rounded"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit className="w-5 h-5 text-gray-700" />
                </button>
              )}

              {isEditing && (
                <button
                  className="p-2 bg-green-200 rounded text-green-700"
                  onClick={async () => {
                    const updated = {
                      ...currentPatient,
                      ...editFields,
                      age: Number(editFields.age),
                    };
                    setPatientData(updated);
                    await updatePatient(pid);
                    setIsEditing(false);
                    setShowSuccess(true);
                    setTimeout(() => setShowSuccess(false), 2000);
                    fetchPatientByID(pid);
                  }}
                >
                  ✔
                </button>
              )}

              {isEditing && (
                <button
                  className="p-2 bg-gray-200 rounded"
                  onClick={() => setIsEditing(false)}
                >
                  ✖
                </button>
              )}

              {!isEditing && (
                <button
                  className="p-2 bg-red-200 rounded"
                  onClick={async () => {
                    if (!window.confirm("Delete this patient?")) return;
                    await deletePatient(pid);
                    navigate("/patient");
                  }}
                >
                  <Trash2 className="w-5 h-5 text-red-700" />
                </button>
              )}
            </div>

            {/* Segmentation */}
            <button
  className="mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg w-44 flex justify-center ml-[4px]"
>
  Segmentation
</button>




          </div>

          {/* MIDDLE COLUMN */}
          <div className="col-span-1 space-y-10">

            {/* Patient Info */}
            <section>
              <h2 className="text-xl font-bold mb-3">Patient Information</h2>
              <div className="grid grid-cols-[130px,1fr] gap-y-4 gap-x-4">
                {makeInput("Name", "name")}
                {makeInput("Patient ID", "pid", true)}
                {makeInput("Gender", "gender")}
                {makeInput("Date of Birth", "dateofbirth", false)}
                {makeInput("Register Date", "createdat", true, toDisplay)}
              </div>
            </section>

            {/* Emergency Contact */}
            <section>
              <h2 className="text-xl font-bold mb-3">Emergency Contact</h2>
              <div className="grid grid-cols-[130px,1fr] gap-y-4 gap-x-4">
                {makeInput("Name", "emergencycontactname")}
                {makeInput("Phone", "emergencycontactphone")}
              </div>
            </section>

            {/* Address */}
            <section>
              <h2 className="text-xl font-bold mb-3">Address</h2>
              <div className="grid grid-cols-[130px,1fr] gap-y-4 gap-x-4">
                {makeInput("Address", "streetaddress")}
                {makeInput("Suburb", "suburb")}
                {makeInput("State", "state")}
                {makeInput("Country", "country")}
                {makeInput("Postcode", "postcode")}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: CT + REPORT + SAMPLE1 */}
          <div className="space-y-10">

            {/* Recorded CT */}
            <section>
              <h3 className="text-lg font-bold mb-2">Recorded CT</h3>
              <table className="w-full text-sm bg-blue-50 rounded-lg overflow-hidden">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {ctData.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.id}</td>
                      <td className="px-3 py-2">{r.type}</td>
                      <td className="px-3 py-2">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Report Table */}
            <section>
              <h3 className="text-lg font-bold mb-2">Report</h3>
              <table className="w-full text-sm bg-blue-50 rounded-lg overflow-hidden">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.id}</td>
                      <td className="px-3 py-2">{r.type}</td>
                      <td className="px-3 py-2">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* Sample1 under Report */}
            <section>
              <img
                src={Sample1}
                alt="Sample 1"
                className="w-full rounded-lg shadow-md object-cover"
              />
            </section>

          </div>

        </div>
      </div>
    </div>
  );
};

export default PatientProfilePage;
