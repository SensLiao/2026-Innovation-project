import { usePatientDB } from "../useDB/usePatients";
import { useRef } from "react";

function AddPatientModal() {
    const { addPatient, patientData, setPatientData, resetPatientData, loading, error } = usePatientDB();
    const dialogRef = useRef();

    const closeModal = () => {
        document.getElementById("add_patient_modal").close();
        resetPatientData();
    };

    return (
        <dialog id="add_patient_modal" ref={dialogRef} className="rounded-xl p-0">
            <form method="dialog" className="w-[95vw] max-w-lg bg-white rounded-xl p-6 flex flex-col gap-4" onSubmit={addPatient}>
                <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-bold">Add Patient</h2>
                    <button type="button" onClick={closeModal} className="text-gray-500 hover:text-black text-2xl">×</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input className="border rounded px-2 py-1" placeholder="Name" value={patientData.name} onChange={e => setPatientData({ ...patientData, name: e.target.value })} required />
                    <input className="border rounded px-2 py-1" placeholder="Age" type="number" value={patientData.age} onChange={e => setPatientData({ ...patientData, age: e.target.value })} required />
                    <input className="border rounded px-2 py-1" placeholder="Date of Birth" type="date" value={patientData.dateofbirth} onChange={e => setPatientData({ ...patientData, dateofbirth: e.target.value })} required />
                    <select className="border rounded px-2 py-1" value={patientData.gender} onChange={e => setPatientData({ ...patientData, gender: e.target.value })} required>
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                    <input className="border rounded px-2 py-1" placeholder="Phone" value={patientData.phone} onChange={e => setPatientData({ ...patientData, phone: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Email" type="email" value={patientData.email} onChange={e => setPatientData({ ...patientData, email: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Profile Photo URL" value={patientData.profilephoto} onChange={e => setPatientData({ ...patientData, profilephoto: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Emergency Contact Name" value={patientData.emergencycontactname} onChange={e => setPatientData({ ...patientData, emergencycontactname: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Emergency Contact Phone" value={patientData.emergencycontactphone} onChange={e => setPatientData({ ...patientData, emergencycontactphone: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Street Address" value={patientData.streetaddress} onChange={e => setPatientData({ ...patientData, streetaddress: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Suburb" value={patientData.suburb} onChange={e => setPatientData({ ...patientData, suburb: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="State" value={patientData.state} onChange={e => setPatientData({ ...patientData, state: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Postcode" value={patientData.postcode} onChange={e => setPatientData({ ...patientData, postcode: e.target.value })} />
                    <input className="border rounded px-2 py-1" placeholder="Country" value={patientData.country} onChange={e => setPatientData({ ...patientData, country: e.target.value })} />
                </div>
                {error && <div className="text-red-600 text-sm">{error}</div>}
                <div className="flex justify-end gap-2 mt-2">
                    <button type="button" onClick={closeModal} className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300">Cancel</button>
                    <button type="submit" className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" disabled={loading}>{loading ? "Adding..." : "Add Patient"}</button>
                </div>
            </form>
        </dialog>
    );
}

export default AddPatientModal;