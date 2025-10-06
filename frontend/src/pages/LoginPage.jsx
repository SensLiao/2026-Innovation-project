import React, { useState, useEffect } from 'react';
import { useAuth } from '../useDB/useAuth';
import { useUserDB } from '../useDB/useUsers';
import { useNavigate } from 'react-router-dom';
import LoginImage from '../assets/images/login.png';
import Decoration from '../assets/images/main2.png';

const LoginPage = () => {
  const { login, loading, error } = useAuth();
  const { addUser, signupData, setSignupData } = useUserDB();
  // const { users, loading, error, fetchUsers, addUser, signupData, setSignupData } = useUserDB();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState(null);
  const [tab, setTab] = useState('login');           
  const navigate = useNavigate();

  // useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const ok = await login(email, password);
    console.log("ok value:", ok);
    console.log({ email, password, ok });

    if (ok) {
      navigate('/patient'); // Redirect to patient dashboard after login
    } else {
      setLoginError('Invalid email or password');
    }
    // const passwordhash = btoa(password); // Simple base64 encoding for passwordhash
    // console.log(passwordhash);
    // console.log(password);
    // const user = (users || []).find(u => u.email === email && u.passwordhash === passwordhash);
    // if (user){
    //   navigate("/patient", {
    //     state: {
    //       profilephoto: user.profilephoto, 
    //       name: user.name,
    //       uid: user.uid,
    //       passwordhash: user.passwordhash,
    //       phone: user.phone,
    //       email: user.email,
    //       createdat: user.createdat,
    //       yearofexperience: user.yearofexperience,
    //       education: user.education,
    //       languages: user.languages
    //     },
    //   });
    // }
    // else setLoginError('Invalid email or password');
  };

  return (
    <div className="flex items-center justify-center p-4">

      {/* white background */}
      <div className="bg-white rounded-lg shadow-lg pl-40 pr-10 py-40 w-[1000px] relative flex justify-end ">
        <div className="absolute top-4 left-4 text-5xl font-extrabold tracking-tight">LOGO</div>

        <img
          src={LoginImage}
          alt="Login illustration"
          className="w-[450px] object-contain absolute left-12 top-1/2 -translate-y-1/2 pointer-events-none select-none"
        />

        <div className="w-[400px]">
            
        {/* Tabs */}
        <div className="flex gap-8 mb-6 text-2xl font-medium">
          <button
            type="button"
            onClick={() => setTab('login')}
            className={`pb-1 bg-transparent border-none outline-none ${tab === 'login' ? 'text-black underline underline-offset-8' : 'text-gray-400'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => setTab('signup')}
            className={`pb-1 bg-transparent border-none outline-none ${tab === 'signup' ? 'text-black underline underline-offset-8' : 'text-gray-400'}`}
          >
            SignUp
          </button>
        </div>

        {/* Login/Signup Box */}
        <div className="relative z-10 rounded-2xl border border-gray-200 p-6 shadow-sm bg-white">
          {tab === 'login' ? (
            // LOGIN FORM
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {loginError && <p className="text-red-600 text-sm">{loginError}</p>}
              {/* {error && <p className="text-red-600 text-sm">Error loading users.</p>} */}

              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 text-white font-semibold py-2 disabled:opacity-60"
                disabled={loading}
              >
                {loading ? 'Loading...' : 'Login'}
              </button>

              <div className="text-right">
                <a href="#" className="text-gray-600 underline text-sm">Forgot password?</a>
              </div>
            </form>
          ) : (
            // SIGNUP FORM
            <form onSubmit={addUser} className="space-y-5">

              {/* Username */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Username"
                  value={signupData.name}
                  onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  // put constraint that email should contain '@' and '.'
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  placeholder="Email"
                  required
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Phone"
                  value={signupData.phone}
                  onChange={(e) => setSignupData({ ...signupData, phone: e.target.value })}
                  required
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <input
                  type="password"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Password"
                  valule={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  minLength={6} // Minimum length of 6 characters
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-md bg-blue-600 text-white font-semibold py-2"
              >
                SignUp
              </button>
            </form>
          )}
        </div>


        
        
        
        <img
          src={Decoration}
          alt="Decoration"
          className="w-[400px] object-contain absolute -bottom-12 -right-12 z-0 pointer-events-none select-none"
        />

        </div>
      </div>
    </div>
  );
};

export default LoginPage;
