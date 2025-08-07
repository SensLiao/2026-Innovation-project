import React, { useState } from 'react';
import { useUserDB } from '../backendFunction/useUsers';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const { users, loading, error, fetchUsers } = useUserDB();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const user = users.find(
      (u) => u.email === email && u.passwordhash === password
    );
    if (user) {
      navigate(`/profile-photo`, { state: { photoUrl: user.profilephoto } });
    } else {
      setLoginError('Invalid email or password');
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: 400, margin: 'auto' }}>
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', marginBottom: '1rem' }}
          />
        </div>
        <button type="submit" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Loading...' : 'Login'}
        </button>
      </form>
      {loginError && <p style={{ color: 'red' }}>{loginError}</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
};

export default LoginPage;
