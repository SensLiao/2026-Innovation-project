import React, { useEffect } from 'react';
import { usePatientsStore } from '../backendFunction/usePatients';

const PatientPage = () => {
  const { patients, loading, error, fetchPatients } = usePatientsStore();

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  console.log(patients);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Patient List</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <ul>
        {patients && patients.length > 0 ? (
          patients.map((patient) => (
            <li key={patient.id || patient._id}>
              {patient.name || patient.fullName || 'Unnamed Patient'}
            </li>
          ))
        ) : (
          !loading && <li>No patients found.</li>
        )}
      </ul>
    </div>
  );
};

export default PatientPage;
