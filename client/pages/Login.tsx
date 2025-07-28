import { useState } from 'react';

export default function Login() {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Background decorative images - hidden on mobile */}
      <div className="absolute inset-0 pointer-events-none hidden lg:block">
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/9fccc1f3213892e175a0d64736850335c40a9e11?width=1692"
          alt=""
          className="absolute left-0 top-32 w-[60vw] max-w-[846px] h-auto object-cover"
        />
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/f7ce4d0a975016c782c041543122b763d3e68225?width=1140"
          alt=""
          className="absolute right-0 bottom-0 w-[40vw] max-w-[570px] h-auto object-cover"
        />
      </div>

      {/* Main content container */}
      <div className="relative z-10 min-h-screen flex flex-col lg:block">
        {/* Logo */}
        <div className="lg:absolute lg:left-[90px] lg:top-[78px] p-6 lg:p-0">
          <h1 className="text-4xl md:text-5xl lg:text-[72px] font-bold text-black lg:leading-[86.4px] lg:tracking-[-2.16px] text-center lg:text-left">
            LOGO
          </h1>
        </div>

        {/* Login form section */}
        <div className="flex-1 flex items-center justify-center lg:absolute lg:right-[107px] lg:top-[158px] lg:w-auto p-6 lg:p-0">
          <div className="w-full max-w-md lg:max-w-none lg:w-auto">
            {/* Tabs */}
            <div className="flex items-start mb-8 lg:mb-[59px] justify-center lg:justify-start">
              <button
                onClick={() => {setActiveTab('login');
                    console.log("Login clicked");}
                }
                className={`px-3 py-1 border-b-2 ${
                  activeTab === 'login'
                    ? 'border-text-primary text-text-primary'
                    : 'border-text-tertiary text-text-tertiary'
                }`}
              >
                <span className={`font-bold text-2xl md:text-3xl lg:text-[48px] lg:leading-[57.6px] lg:tracking-[-0.96px]`}>
                  Login
                </span>
              </button>
              <button
                onClick={() => {setActiveTab('signup');
                    console.log("SignUp clicked");}}
                className={`px-3 py-1 border-b-2 ml-2 ${
                  activeTab === 'signup'
                    ? 'border-text-primary text-text-primary'
                    : 'border-text-tertiary text-text-tertiary'
                }`}
              >
                <span className={`font-bold text-2xl md:text-3xl lg:text-[48px] lg:leading-[57.6px] lg:tracking-[-0.96px]`}>
                  SignUp
                </span>
              </button>
            </div>

            {/* Login form */}
            <div className="w-full lg:w-[578px] bg-white border border-border-default rounded-lg p-6 flex flex-col gap-6">
              {/* Username field */}
              <div className="flex flex-col gap-2">
                <label className="text-text-primary text-base font-normal leading-[22.4px]">
                  Username
                </label>
                <div className="border border-border-default rounded-lg px-4 py-3 bg-white">
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) => handleInputChange('username', e.target.value)}
                    placeholder="Username"
                    className="w-full text-base text-text-tertiary leading-4 bg-transparent border-none outline-none placeholder-text-tertiary"
                  />
                </div>
              </div>

              {/* Password field */}
              <div className="flex flex-col gap-2">
                <label className="text-text-primary text-base font-normal leading-[22.4px]">
                  Password
                </label>
                <div className="border border-border-default rounded-lg px-4 py-3 bg-white">
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    placeholder="Password"
                    className="w-full text-base text-text-tertiary leading-4 bg-transparent border-none outline-none placeholder-text-tertiary"
                  />
                </div>
              </div>

              {/* Login button */}
              <button className="w-full bg-button-dark border border-button-dark rounded-lg py-3 px-3 flex justify-center items-center gap-2 hover:bg-opacity-90 transition-all">
                <span className="text-button-dark-text text-base font-normal leading-4">
                  Login
                </span>
              </button>

              {/* Forgot password link */}
              <a
                href="#"
                className="text-text-primary text-base font-normal leading-[22.4px] underline decoration-solid underline-offset-auto hover:text-opacity-80 transition-all"
              >
                Forgot password?
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
