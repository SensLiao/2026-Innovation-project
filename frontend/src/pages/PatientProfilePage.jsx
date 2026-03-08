import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePatientStore } from "../stores/usePatientStore";
import Logo from "../assets/images/Logo.png";
import { Edit, Trash2, Upload, UserRound, Phone, MapPin } from "lucide-react";
import { toDDMMYYYY, toDDMMYYYYHHMM } from "../components/Header";

const PatientProfilePage = () => {
  const { pid } = useParams();
  const navigate = useNavigate();
  const {
    currentPatient,
    fetchPatientByID,
    loading,
    error,
    setPatientData,
    updatePatient,
    deletePatient,
  } = usePatientStore();

  const [showSuccess, setShowSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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

  const [profileUploading, setProfileUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const compressImageToDataUrl = (file, maxWidth = 1024, quality = 0.8) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const ratio = Math.min(1, maxWidth / Math.max(img.width, img.height));
          const w = Math.round(img.width * ratio);
          const h = Math.round(img.height * ratio);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL("image/jpeg", quality);
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

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      alert("Only JPG and PNG files are allowed");
      e.target.value = "";
      return;
    }

    const MAX_RAW_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_RAW_SIZE) {
      alert("File is too large (max 5MB). Please choose a smaller image.");
      e.target.value = "";
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

      setPatientData({ ...currentPatient, profilephoto: dataUrl });
      await updatePatient(currentPatient.pid);

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        fetchPatientByID(currentPatient.pid).catch((err) =>
          console.error("Error refreshing patient after upload:", err)
        );
      }, 1200);
    } catch (err) {
      console.error("Error uploading profile photo:", err);
      alert("Failed to upload profile photo: " + (err.message || "Unknown"));
    } finally {
      e.target.value = "";
      setProfileUploading(false);
    }
  };

  useEffect(() => {
    if (!currentPatient || String(currentPatient.pid) !== String(pid)) {
      fetchPatientByID(pid);
    } else if (!isEditing) {
      setEditFields({
        name: currentPatient.name || "",
        age: currentPatient.age ?? "",
        gender: currentPatient.gender || "",
        dateofbirth: currentPatient.dateofbirth || "",
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
  }, [pid, fetchPatientByID, currentPatient, isEditing]);

  const formatDateForInput = (d) => {
    if (!d) return "";
    try {
      return d.slice(0, 10);
    } catch {
      return "";
    }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditFields({
      name: currentPatient.name || "",
      age: currentPatient.age ?? "",
      gender: currentPatient.gender || "",
      dateofbirth: formatDateForInput(currentPatient.dateofbirth) || "",
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
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditFields({
      name: currentPatient.name || "",
      age: currentPatient.age ?? "",
      gender: currentPatient.gender || "",
      dateofbirth: formatDateForInput(currentPatient.dateofbirth) || "",
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
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditFields((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      setPatientData({ ...currentPatient, ...editFields });
      await updatePatient(currentPatient.pid);
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error("Error saving patient:", err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this patient?")) return;
    try {
      await deletePatient(currentPatient.pid);
      navigate("/patient");
    } catch (err) {
      console.error("Error deleting patient:", err);
    }
  };

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;
  if (!currentPatient) return <div className="p-8">No patient data found.</div>;

  const {
    profilephoto,
    name,
    dateofbirth,
    gender,
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
    <div className="min-h-screen bg-[#C2DCE7] py-10 px-4">
      {showSuccess && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg z-50">
          Update Successful
        </div>
      )}

      <div className="w-[70vw] max-w-[1400px] mx-auto">
        <div className="bg-white rounded-[32px] shadow-2xl p-8 md:p-10 relative overflow-hidden border border-white/60">
          <div className="absolute top-6 right-28 w-24 h-24 bg-sky-100/70 rounded-full blur-xl pointer-events-none" />
          <div className="absolute bottom-10 left-10 w-28 h-28 bg-blue-100/50 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-center justify-between border-b border-slate-200 pb-5 mb-8 relative">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-2xl text-slate-700 hover:bg-slate-100 transition"
                aria-label="Go back"
                title="Go back"
              >
                ←
              </button>

              <div>
                <h2 className="text-3xl font-bold text-slate-800">Patient Profile</h2>
                <p className="text-sm text-slate-500 mt-1">
                  View and manage patient records
                </p>
              </div>
            </div>

            <img
              src={Logo}
              alt="Logo"
              className="w-[170px] object-contain pointer-events-none select-none"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-6">
            <div className="bg-gradient-to-b from-[#EEF7FF] to-white border border-sky-100 rounded-3xl p-5 shadow-sm">
              <div className="flex flex-col items-center">
                <input
                  id="profilephoto-input"
                  type="file"
                  accept="image/png, image/jpeg"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading || profileUploading}
                  className="group relative w-40 h-40 rounded-2xl overflow-hidden border-4 border-blue-200 shadow-md bg-white flex items-center justify-center"
                  title="Click to upload profile photo"
                >
                  {profilephoto ? (
                    <img src={profilephoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-400">
                      <UserRound className="w-10 h-10 mb-2" />
                      <span className="text-sm">No Photo</span>
                    </div>
                  )}

                  <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-xs py-2 opacity-0 group-hover:opacity-100 transition">
                    Upload photo
                  </div>

                  {profileUploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-sm font-medium text-slate-700">
                      Uploading...
                    </div>
                  )}
                </button>

                {/* <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                >
                  <Upload className="w-4 h-4" />
                  Change Photo
                </button> */}

                <div className="mt-5 text-center">
                  <h3 className="text-xl font-semibold text-slate-800">
                    {name || "Unnamed Patient"}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1">Patient ID #{patientPid ?? "-"}</p>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  {isEditing ? (
                    <>
                      <button
                        onClick={handleSave}
                        disabled={loading}
                        className={`px-4 py-2 rounded-xl text-white font-medium shadow ${
                          loading ? "bg-emerald-300" : "bg-emerald-500 hover:bg-emerald-600"
                        }`}
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleEditClick}
                        className="p-3 bg-slate-100 hover:bg-slate-200 rounded-xl"
                        aria-label="Edit"
                        title="Edit"
                      >
                        <Edit className="w-5 h-5 text-slate-700" />
                      </button>
                      <button
                        onClick={handleDelete}
                        className="p-3 bg-red-50 hover:bg-red-100 rounded-xl"
                        aria-label="Delete"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5 text-red-600" />
                      </button>
                    </>
                  )}
                </div>

                <button className="mt-6 w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-3 rounded-2xl font-medium shadow-sm transition">
                  Segmentation
                </button>
              </div>
            </div>

            <div className="space-y-6 min-w-0">
              <SectionCard
                title="Patient Information"
                icon={<UserRound className="w-5 h-5 text-blue-600" />}
              >
                <FieldRow
                  label="Name"
                  name="name"
                  value={isEditing ? editFields.name : name || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
                <FieldRow label="Patient ID" value={patientPid ?? ""} editable={false} />

                <SelectRow
                  label="Gender"
                  name="gender"
                  value={isEditing ? editFields.gender : gender || ""}
                  onChange={handleChange}
                  editable={isEditing}
                  options={["Male", "Female", "Other"]}
                />

                {isEditing ? (
                  <FieldRow
                    label="Date of Birth"
                    name="dateofbirth"
                    value={editFields.dateofbirth || ""}
                    onChange={handleChange}
                    editable
                    type="date"
                  />
                ) : (
                  <FieldRow
                    label="Date of Birth"
                    value={toDDMMYYYY(dateofbirth)}
                    editable={false}
                  />
                )}

                <FieldRow
                  label="Register Date"
                  value={toDDMMYYYYHHMM(createdat)}
                  editable={false}
                />
              </SectionCard>

              <SectionCard
                title="Emergency Contact"
                icon={<Phone className="w-5 h-5 text-blue-600" />}
              >
                <FieldRow
                  label="Name"
                  name="emergencycontactname"
                  value={isEditing ? editFields.emergencycontactname : emergencycontactname || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
                <FieldRow
                  label="Phone"
                  name="emergencycontactphone"
                  value={isEditing ? editFields.emergencycontactphone : emergencycontactphone || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
              </SectionCard>

              <SectionCard
                title="Address"
                icon={<MapPin className="w-5 h-5 text-blue-600" />}
              >
                <FieldRow
                  label="Street"
                  name="streetaddress"
                  value={isEditing ? editFields.streetaddress : streetaddress || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
                <FieldRow
                  label="Suburb"
                  name="suburb"
                  value={isEditing ? editFields.suburb : suburb || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
                <FieldRow
                  label="State"
                  name="state"
                  value={isEditing ? editFields.state : patientState || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
                <FieldRow
                  label="Postcode"
                  name="postcode"
                  value={isEditing ? editFields.postcode : postcode || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
                <FieldRow
                  label="Country"
                  name="country"
                  value={isEditing ? editFields.country : country || ""}
                  onChange={handleChange}
                  editable={isEditing}
                />
              </SectionCard>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SectionCard({ title, icon, children }) {
  return (
    <div className="bg-[#F9FCFF] border border-sky-100 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="text-xl font-semibold text-slate-800">{title}</h3>
        <div className="flex-1 border-b border-slate-200 ml-2" />
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function FieldRow({
  label,
  name,
  value,
  onChange,
  editable = false,
  type = "text",
}) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-5">
      <label className="text-sm font-medium text-slate-600">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={editable ? onChange : undefined}
        readOnly={!editable}
        className={`w-full rounded-xl px-4 py-3 text-sm border transition ${
          editable
            ? "bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
            : "bg-slate-50 border-slate-200 text-slate-700"
        }`}
      />
    </div>
  );
}

function SelectRow({
  label,
  name,
  value,
  onChange,
  editable = false,
  options = [],
}) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-center gap-5">
      <label className="text-sm font-medium text-slate-600">{label}</label>

      {editable ? (
        <select
          name={name}
          value={value}
          onChange={onChange}
          className="w-full rounded-xl px-4 py-3 text-sm border bg-white border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <option value="">Select gender</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          readOnly
          className="w-full rounded-xl px-4 py-3 text-sm border bg-slate-50 border-slate-200 text-slate-700"
        />
      )}
    </div>
  );
}

export default PatientProfilePage;