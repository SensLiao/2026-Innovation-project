import React, { useEffect, useMemo, useState } from "react";
import { usePatientDB } from "../useDB/usePatients";
import { useLocation, useNavigate } from "react-router-dom";
import "./patient.css";
import main from "../assets/images/Main.png";
import Decoration from '../assets/images/main2.png';
import AddPatientModal from "../components/AddPatientModal";
import Header from "../components/Header";
import { toDDMMYYYY } from "../components/Header";

const PatientPage = () => {
  const { patients, loading, error, fetchPatients, deletePatient, fetchPatientByID, updatePatient, setPatientData, patientData } = usePatientDB();
  const [q, setQ] = useState("");
  const [editPid, setEditPid] = useState(null);
  const [editFields, setEditFields] = useState({ name: '', age: '', gender: '', email: '' });

  // Get profile photo passed from Login OR fallback to localStorage
  const { state } = useLocation();

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  // ------- Sort/search state + helpers -------
  const [sort, setSort] = useState({ key: "pid", dir: "asc" }); // keys: pid | name | age | gender | date | email
  const [searchKey, setSearchKey] = useState("pid");

  const labelByKey = {
    pid: "PID",
    name: "Name",
    age: "Age",
    gender: "Gender",
    date: "Registered Date",
    email: "Email",
  };

  const headerClick = (key) => {
    // toggle sort if same key, else default to asc
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    // make search target this field
    setSearchKey(key);
  };

  const getDateMs = (val) => {
    if (!val) return NaN;
    if (val?.toDate) val = val.toDate();
    if (val?.seconds) val = new Date(val.seconds * 1000);
    const d = val instanceof Date ? val : new Date(val);
    const ms = d.getTime();
    return Number.isNaN(ms) ? NaN : ms;
  };

  const numFromPid = (p) => {
    const raw = p.pid ?? p._pid ?? p.id ?? "";
    const m = String(raw).match(/\d+/);
    return m ? Number(m[0]) : Number(raw);
  };

  const getSortValue = (p, key) => {
    switch (key) {
      case "pid":
        return numFromPid(p);
      case "name":
        return (p.name || p.fullName || "").toLowerCase();
      case "age":
        return typeof p.age === "number" ? p.age : Number(p.age);
      case "gender":
        return (p.gender || "").toLowerCase();
      case "email":
        return (p.email || "").toLowerCase();
      case "date":
        return getDateMs(p.createdat || p.registeredDate || p.createdAt);
      default:
        return "";
    }
  };

  // value used for filtering (string compare)
  const getFilterValue = (p, key) => {
    switch (key) {
      case "pid": {
        const v = p.pid ?? p._pid ?? p.id ?? "";
        return String(v);
      }
      case "name":
        return String(p.name || p.fullName || "");
      case "age":
        return String(typeof p.age === "number" ? p.age : p.age || "");
      case "gender":
        return String(p.gender || "");
      case "email":
        return String(p.email || "");
      case "date": {
        const raw = p.createdat || p.registeredDate || p.createdAt;
        return toDDMMYYYY(raw); // search the formatted string
      }
      default:
        return "";
    }
  };

  const SortIcon = ({ active, dir }) => (
    <span className="ml-1 text-xs">{active ? (dir === "asc" ? "▲" : "▼") : "↕︎"}</span>
  );

  // ------- Filter (by active field) + Sort -------
  const rows = useMemo(() => {
    const list = Array.isArray(patients) ? patients : [];
    const s = q.trim().toLowerCase();

    const filtered = !s
      ? list
      : list.filter((p) => getFilterValue(p, searchKey).toLowerCase().includes(s));

    const dir = sort.dir === "asc" ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const A = getSortValue(a, sort.key);
      const B = getSortValue(b, sort.key);

      const aEmpty =
        A === undefined || A === null || (typeof A === "number" && Number.isNaN(A)) || A === "";
      const bEmpty =
        B === undefined || B === null || (typeof B === "number" && Number.isNaN(B)) || B === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1; // push empties to end
      if (bEmpty) return -1;

      if (typeof A === "number" && typeof B === "number") return (A - B) * dir;
      return String(A).localeCompare(String(B)) * dir;
    });
  }, [patients, q, sort, searchKey]);

  

   // ---------------- Navigation  -------------------
  const navigate = useNavigate();


  return (
    <div className="min-h-screen bg-[#C2DCE7] p-6 md:p-10 flex justify-center">
      
      {/* Decorative blobs */}
      <div className="relative w-full max-w-6xl">
        <div className="absolute -right-20 bottom-80 hidden md:block deco-blob-sm" />
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-10 -left-60 z-0 pointer-events-none select-none"
        />

        {/* White sheet */}
        <div className="bg-white rounded-3xl shadow-2xl px-6 md:px-12 py-8 md:py-10 pb-16 relative">
          
          {/* Header */}
          <Header 
            activeTab="patient"
            showLogout={true}
            showAddPatient={true}
            onAddPatientClick={() => document.getElementById("add_patient_modal").showModal()}
          />
          {/* Add Patient Modal */}
          <AddPatientModal />



          {/* Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mt-10 md:mt-12 items-center">
            <div>
              <h1 className="text-5xl md:text-6xl font-extrabold text-[#3B82F6] leading-none">
                SOMA <span className="text-black text-4xl md:text-5xl font-semibold">Health</span>
              </h1>
              <div className="mt-4 text-gray-500 text-lg">
                <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle mr-3" />
                <span className="align-middle">Description</span>
                <span className="inline-block border-t-2 border-dotted border-gray-400 w-56 align-middle ml-3" />
              </div>
            </div>
          </div>

          {/* main image */}
          <img
            src={main}
            alt="Login illustration"
            className="w-[450px] object-contain absolute right-12 top-1/3 -translate-y-1/2 pointer-events-none select-none"
          />

          {/* Search */}
          <div className="mt-10">
            <div className="relative max-w-xl">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M21 21l-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Search by ${labelByKey[searchKey]} ...`}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-[11px] md:text-xs border-separate border-spacing-y-2">
            <thead>
              <tr className="text-gray-500 text-[11px] md:text-xs">
                {[
                  { key: "pid", label: "PID" },
                  { key: "name", label: "Name" },
                  { key: "age", label: "Age" },
                  { key: "gender", label: "Gender" },
                  { key: "date", label: "Registered Date" },
                  { key: "email", label: "Email" },
                ].map(({ key, label }) => {
                  const active = sort.key === key;
                  return (
                    <th key={key} className="px-4">
                      <button
                        type="button"
                        onClick={() => headerClick(key)}
                        className={`inline-flex items-center pb-1 border-b-2 ${
                          active
                            ? "text-black border-black"
                            : "text-gray-500 border-transparent hover:text-black"
                        }`}
                        title={`Click to sort & search by ${label}`}
                      >
                        {label}
                        <SortIcon active={active} dir={sort.dir} />
                      </button>
                    </th>
                  );
                })}
                <th className="px-4">Actions</th>
              </tr>
            </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td className="px-4 py-3" colSpan={7}>
                      Loading...
                    </td>
                  </tr>
                )}
                {error && (
                  <tr>
                    <td className="px-4 py-3 text-red-600" colSpan={7}>
                      Error: {error}
                    </td>
                  </tr>
                )}
                {!loading && !error && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-3" colSpan={7}>
                      No patients found.
                    </td>
                  </tr>
                )}

                {rows.map((p, idx) => {
                  const pid = p.pid || p._pid || p.id || idx + 1;
                  const name = p.name || p.fullName || "Unnamed Patient";
                  const age = p.age ?? "";
                  const gender = p.gender || "";
                  const email = p.email || "—";
                  const regRaw = p.createdat || p.registeredDate || p.createdAt || "—";
                  const reg = toDDMMYYYY(regRaw);

                  const isEditing = editPid === pid;

                  return (
                    <tr key={pid}>
                      <td className="px-4">
                        <div className="row-card">{pid}</div>
                      </td>
                      <td className="px-4">
                        <div className="row-card">
                          {isEditing ? (
                            <input
                              className="border rounded px-2 py-1 w-24"
                              value={editFields.name}
                              onChange={e => setEditFields(f => ({ ...f, name: e.target.value }))}
                            />
                          ) : name}
                        </div>
                      </td>
                      <td className="px-4">
                        <div className="row-card w-20 text-center">
                          {isEditing ? (
                            <input
                              className="border rounded px-2 py-1 w-12 text-center"
                              type="number"
                              value={editFields.age}
                              onChange={e => setEditFields(f => ({ ...f, age: e.target.value }))}
                            />
                          ) : age}
                        </div>
                      </td>
                      <td className="px-4">
                        <div className="row-card w-24">
                          {isEditing ? (
                            <select
                              className="border rounded px-2 py-1 w-20"
                              value={editFields.gender}
                              onChange={e => setEditFields(f => ({ ...f, gender: e.target.value }))}
                            >
                              <option value="">—</option>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          ) : (
                            <span className="inline-block text-xs px-2 py-1 rounded-full bg-gray-100 border border-gray-300">
                              {gender || "—"}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4">
                        <div className="row-card w-32">{reg}</div>
                      </td>
                      <td className="px-4">
                        <div className="row-card">
                          {isEditing ? (
                            <input
                              className="border rounded px-2 py-1 w-32"
                              type="email"
                              value={editFields.email}
                              onChange={e => setEditFields(f => ({ ...f, email: e.target.value }))}
                            />
                          ) : email}
                        </div>
                      </td>
                      <td className="px-4">
                        <div className="row-card flex items-center justify-end gap-2">
                          {/* Edit/Save/Cancel */}
                          {isEditing ? (
                            <>
                              <button
                                className="icon-btn text-green-600"
                                title="Save"
                                onClick={async () => {
                                  setPatientData({ ...p, ...editFields });
                                  await updatePatient(pid);
                                  setEditPid(null);
                                  fetchPatients();
                                }}
                              >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="1.6" fill="none" />
                                </svg>
                              </button>
                              <button
                                className="icon-btn text-gray-500"
                                title="Cancel"
                                onClick={() => setEditPid(null)}
                              >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                                  <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.6" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <button
                              className="icon-btn"
                              title="Edit"
                              onClick={() => {
                                setEditPid(pid);
                                setEditFields({
                                  name: p.name || p.fullName || "",
                                  age: p.age ?? "",
                                  gender: p.gender || "",
                                  email: p.email || "",
                                });
                              }}
                            >
                              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                                <path
                                  d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Z"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                />
                                <path d="M14.06 6.19l3.75 3.75" stroke="currentColor" strokeWidth="1.6" />
                              </svg>
                            </button>
                          )}
                          {/* View */}
                          <button
                            className="icon-btn"
                            title="View"
                            onClick={async () => {
                              navigate(`/patient/${pid}`);
                            }}
                          >
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                              <path
                                d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"
                                stroke="currentColor"
                                strokeWidth="1.6"
                              />
                              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                            </svg>
                          </button>
                          {/* Delete */}
                          <button className="icon-btn" title="Delete"
                            onClick={()=> deletePatient(pid)}>
                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                              <path
                                d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"
                                stroke="currentColor"
                                strokeWidth="1.6"
                              />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination (static) */}
          <div className="mt-4 flex justify-end items-center gap-3 text-gray-700">
            <button className="icon-btn" title="First">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M6 6v12M18 6l-6 6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="icon-btn" title="Prev">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <span className="px-2">1</span>
            <button className="icon-btn" title="Next">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M9 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button className="icon-btn" title="Last">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M18 6v12M6 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientPage;
