import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePatientStore } from "../stores/usePatientStore";
import Logo from "../assets/images/Logo.png";
import { Edit, Trash2 } from "lucide-react";
import { toDDMMYYYY, toDDMMYYYYHHMM } from "../components/Header";


const PatientProfilePage = () => {
  const { pid } = useParams();
  const navigate = useNavigate();
  const { currentPatient, fetchPatientByID, loading, error, setPatientData, updatePatient, deletePatient } = usePatientStore();
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

  // Profile upload state and helpers
  const [profileUploading, setProfileUploading] = useState(false);
  const fileInputRef = useRef(null);

  const fileToDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Resize/compress an image via canvas and return a dataURL (JPEG)
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
    // Create object URL for faster load
    img.src = URL.createObjectURL(file);
  });

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // basic validation
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      alert('Only JPG and PNG files are allowed');
      e.target.value = '';
      return;
    }

    // hard limit: 5MB
    const MAX_RAW_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_RAW_SIZE) {
      alert('File is too large (max 5MB). Please choose a smaller image.');
      e.target.value = '';
      return;
    }

    setProfileUploading(true);
    try {
      let dataUrl;

      // If larger than ~500KB, compress/rescale to reduce payload
      if (file.size > 500 * 1024) {
        dataUrl = await compressImageToDataUrl(file, 1024, 0.8);
      } else {
        dataUrl = await fileToDataUrl(file);
      }

      // Update local state immediately for responsive UI
      setPatientData({ ...currentPatient, profilephoto: dataUrl });

      // Persist via store action so it also updates `currentPatient` and triggers re-render
      await updatePatient(currentPatient.pid);

      // Show success and refresh patient data shortly so the saved image is fetched without a full reload
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        // Re-fetch current patient to ensure server-saved image is displayed without full reload
        fetchPatientByID(currentPatient.pid).catch(err => console.error('Error refreshing patient after upload:', err));
      }, 1200);
    } catch (err) {
      console.error('Error uploading profile photo:', err);
      alert('Failed to upload profile photo: ' + (err.message || 'Unknown'));
    } finally {
      e.target.value = '';
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
  }, [pid, fetchPatientByID, currentPatient, isEditing]);

  // Format date (YYYY-MM-DD) for <input type="date"> value
  const formatDateForInput = (d) => {
    if (!d) return '';
    try { return d.slice(0,10); } catch { return ''; }
  };

  const handleEditClick = () => {
    setIsEditing(true);
    setEditFields({
      name: currentPatient.name || '',
      age: currentPatient.age ?? '',
      gender: currentPatient.gender || '',
      dateofbirth: formatDateForInput(currentPatient.dateofbirth) || '',
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
  };

  const handleCancel = () => {
    setIsEditing(false);
    // reset edit fields to current values
    setEditFields({
      name: currentPatient.name || '',
      age: currentPatient.age ?? '',
      gender: currentPatient.gender || '',
      dateofbirth: formatDateForInput(currentPatient.dateofbirth) || '',
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
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditFields(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    try {
      // Merge editable fields into patient payload and set it for update
      setPatientData({ ...currentPatient, ...editFields });
      await updatePatient(currentPatient.pid);
      setIsEditing(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 2000);
    } catch (err) {
      console.error('Error saving patient:', err);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this patient?')) return;
    try {
      await deletePatient(currentPatient.pid);
      navigate('/patient');
    } catch (err) {
      console.error('Error deleting patient:', err);
    }
  };

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

        {/* Main Content Layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Left (2/3) */}
          <div className="col-span-2">
            
            {/* Patient Info Card */}
            <div className="flex items-start gap-4 mb-6">
            <div className="flex-shrink-0">
              {/*------------------------------------Patient Profile Photo (clickable upload) --------------------------------------*/}
              <div className="relative">
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
                  className="w-32 h-32 rounded-lg overflow-hidden border-4 border-blue-200 shadow p-0 bg-transparent flex items-center justify-center"
                  title="Click to upload profile photo"
                >
                  {profilephoto ? (
                    <img src={profilephoto} alt="Profile" className="w-32 h-32 object-cover" />
                  ) : (
                    <div className="w-32 h-32 bg-gray-100 flex items-center justify-center text-gray-400">
                      No Photo
                    </div>
                  )}
                </button>

                {profileUploading && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-white/80 px-2 py-1 rounded">Uploading...</div>
                  </div>
                )}
              </div>

              {/* ------------------------------------Buttons under profile ------------------------------*/}
              {/* Edit / Delete or Save / Cancel Buttons */}
              <div className="flex justify-center gap-4 w-32 mt-2">
                {isEditing ? (
                  <>
                    <button onClick={handleSave} disabled={loading} className={`p-2 ${loading ? 'bg-green-300' : 'bg-green-500 hover:bg-green-600'} text-white rounded`} title="Save">Save</button>
                    <button onClick={handleCancel} className="p-2 bg-gray-200 hover:bg-gray-300 rounded" title="Cancel">Cancel</button>
                  </>
                ) : (
                  <>
                    <button onClick={handleEditClick} className="p-2 bg-gray-200 hover:bg-gray-300 rounded" aria-label="Edit" title="Edit">
                      <Edit className="w-5 h-5 text-gray-700" />
                    </button>
                    <button onClick={handleDelete} className="p-2 bg-red-100 hover:bg-red-200 rounded" aria-label="Delete" title="Delete">
                      <Trash2 className="w-5 h-5 text-red-600" />
                    </button>
                  </>
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

              {/* Patient Information */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  Patient Information
                  <span className="border-b border-gray-200 w-24" />
                </h3>

                <div className="grid grid-cols-[auto,1fr] gap-y-3 gap-x-4 mt-2">
                  <label className="text-sm text-gray-600 flex items-center">Name</label>
                  <input name="name" value={isEditing ? editFields.name : (name || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Patient ID</label>
                  <input value={patientPid ?? ""} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Gender</label>
                  <input name="gender" value={isEditing ? editFields.gender : (gender || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Date of Birth</label>
                  {isEditing ? (
                    <input type="date" name="dateofbirth" value={editFields.dateofbirth || ''} onChange={handleChange} className="w-full bg-white border border-gray-200 rounded-md px-2 py-1 text-sm" />
                  ) : (
                    <input value={toDDMMYYYY(dateofbirth)} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                  )}

                  <label className="text-sm text-gray-600 flex items-center">Register Date</label>
                  <input value={toDDMMYYYYHHMM(createdat)} readOnly className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                </div>
              </div>
            </section>

              {/* Emergency Contact */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  Emergency Contact
                  <span className="border-b border-gray-200 w-24" />
                </h3>

                <div className="grid grid-cols-[auto,1fr] gap-y-3 gap-x-4 mt-2">
                  <label className="text-sm text-gray-600 flex items-center">Name</label>
                  <input name="emergencycontactname" value={isEditing ? editFields.emergencycontactname : (emergencycontactname || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Phone</label>
                  <input name="emergencycontactphone" value={isEditing ? editFields.emergencycontactphone : (emergencycontactphone || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                </div>
              </div>
            </section>

              {/* Address */}
              <div>
                <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                  Address
                  <span className="border-b border-gray-200 w-48" /> 
                </h3>

                <div className="grid grid-cols-[auto,1fr] gap-y-3 gap-x-4 mt-2">
                  <label className="text-sm text-gray-600 flex items-center">Street</label>
                  <input name="streetaddress" value={isEditing ? editFields.streetaddress : (streetaddress || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Suburb</label>
                  <input name="suburb" value={isEditing ? editFields.suburb : (suburb || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">State</label>
                  <input name="state" value={isEditing ? editFields.state : (patientState || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Postcode</label>
                  <input name="postcode" value={isEditing ? editFields.postcode : (postcode || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />

                  <label className="text-sm text-gray-600 flex items-center">Country</label>
                  <input name="country" value={isEditing ? editFields.country : (country || "")} onChange={isEditing ? handleChange : undefined} readOnly={!isEditing} className="w-full bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-sm" />
                </div>
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
