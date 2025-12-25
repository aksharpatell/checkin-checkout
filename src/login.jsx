import React, { useState } from 'react';
import logo from './assets/sardhar dham logo.png';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Credentials configuration
  const users = {
    'User': { 
      password: 'akshar', 
      role: 'admin', 
      access: 'all',
      displayName: 'Master Admin'
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Simulate loading delay
    setTimeout(() => {
      const user = users[username];

      if (user && user.password === password) {
        // Successful login
        onLogin({
          username: username,
          role: user.role,
          access: user.access,
          displayName: user.displayName
        });
      } else {
        setError('Invalid username or password');
        setLoading(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-yellow-50 flex items-center justify-center p-4">
      <div className="h-3 bg-gradient-to-r from-orange-600 via-red-600 to-yellow-600 fixed top-0 left-0 right-0"></div>
      
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl p-8 border-4 border-orange-300">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-block relative mb-4">
              <div className="absolute inset-0 bg-orange-400 blur-2xl opacity-30 rounded-full"></div>
            </div>
            <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-orange-700 via-red-700 to-orange-800 mb-2">
              Check-In Check-Out
            </h1>
            <p className="text-gray-600 font-semibold">Living Accommodation Setup</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                 Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-3 border-2 border-orange-300 rounded-xl focus:ring-4 focus:ring-orange-200 focus:border-orange-500 transition"
                placeholder="Insert Username"
                required
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border-2 border-orange-300 rounded-xl focus:ring-4 focus:ring-orange-200 focus:border-orange-500 transition"
                placeholder="Insert Password"
                required
                autoComplete="off"
                data-lpignore="true"
              />
            </div>

            {error && (
              <div className="bg-red-50 border-2 border-red-300 text-red-700 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-bold rounded-xl transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Login' : 'Login'}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Username - User
              <br />
              Password - akshar
            </p>
          </div>
        </div>
      </div>
	  {/* Developer Credit */}
<div className="fixed bottom-2 right-2">
  <p className="text-[10px] text-gray-400">
    Akshar Patel
  </p>
</div>
    </div>
  );
};

export default Login;