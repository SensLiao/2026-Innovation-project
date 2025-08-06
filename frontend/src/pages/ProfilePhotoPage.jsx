import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const ProfilePhotoPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const photoUrl = location.state?.photoUrl;

  if (!photoUrl) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2>No Profile Photo Found</h2>
        <button onClick={() => navigate('/login')}>Back to Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h2>Profile Photo</h2>
      <img src={photoUrl} alt="Profile" style={{ maxWidth: '300px', borderRadius: '8px' }} />
      <div>
        <button onClick={() => navigate('/login')} style={{ marginTop: '1rem' }}>Back to Login</button>
      </div>
    </div>
  );
};

export default ProfilePhotoPage;
