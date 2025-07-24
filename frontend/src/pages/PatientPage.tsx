import { useEffect, useState } from 'react';
import type { Patient } from '../../../shared/types';

// interface Patient {
//   id: number;
//   name: string;
//   age: number;
//   gender: string;
//   phone?: string;
//   email?: string;
//   profilephoto: string;
// }

const PatientPage = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/patients')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setPatients(data.data);
        } else {
          setError('Failed to fetch patients');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error fetching patients');
        setLoading(false);
      });
  }, []);

  if (loading) return <div>Loading patients...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <h1>All Patients</h1>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center' }}>
        {patients.map((patient) => (
          <div key={patient.id} style={{ border: '1px solid #ccc', borderRadius: '8px', padding: '1rem', minWidth: '200px', textAlign: 'center' }}>
            <img src={patient.profilephoto} alt={patient.name} style={{ width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover' }} />
            <h2>{patient.name}</h2>
            <p>Age: {patient.age}</p>
            <p>Gender: {patient.gender}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatientPage; 