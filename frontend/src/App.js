import React, { useState, useEffect } from 'react';
import LoginForm from './components/LoginForm';
import RegisterForm from './components/RegisterForm';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/AdminDashboard';
import OrganizerDashboard from './components/OrganizerDashboard';
import { verifyToken } from './services/api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function App() {
  const [user, setUser] = useState(null); 
  const [token, setToken] = useState(localStorage.getItem('token')); 
  const [showRegister, setShowRegister] = useState(false); 

  const [forceChangePassword, setForceChangePassword] = useState(false);
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changeMsg, setChangeMsg] = useState('');

  useEffect(() => {
    if (token) {
      loadUser();
    }
  }, [token]);

  const loadUser = () => {
    verifyToken(token)
      .then(data => {
        if (data.valid) {
          setUser(data.user); 
          if (data.user.mustChangePassword) {
            setForceChangePassword(true);
          }
        } else {
          logout(); 
        }
      })
      .catch(() => logout());
  };

  const logout = () => {
    localStorage.removeItem('token'); 
    setToken(null);
    setUser(null);
    setForceChangePassword(false);
    setTempPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setChangeMsg('');
  };

  const handleForcePasswordChange = async () => {
    setChangeMsg('');
    if (!tempPassword || !newPassword) {
      setChangeMsg('Please fill in all fields');
      return;
    }
    if (newPassword.length < 6) {
      setChangeMsg('New password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setChangeMsg('Passwords do not match');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/password/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: tempPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setForceChangePassword(false);
        setTempPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        setChangeMsg('');
        loadUser(); 
      } else {
        setChangeMsg(data.message || 'Failed to change password');
      }
    } catch (err) {
      setChangeMsg('Error changing password');
    }
  };

  if (user) {
    if (forceChangePassword) {
      return (
        <div className="max-w-md mx-auto px-6 py-4 mt-16">
          <div className="bg-yellow-100 p-4 border border-yellow-500 rounded-md mb-5">
            <strong>Password Change Required</strong>
            <p className="mt-1 text-yellow-800">
              Your password was reset by the admin. Please set a new password to continue.
            </p>
          </div>
          <h2>Set New Password</h2>
          <div>
            <label className="block font-bold mb-1">Temporary Password (from admin)</label>
            <input 
              type="password" 
              placeholder="Enter the password provided by admin" 
              value={tempPassword} 
              onChange={(e) => setTempPassword(e.target.value)}
              className="mb-4"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">New Password</label>
            <input 
              type="password" 
              placeholder="Enter your new password (min 6 characters)" 
              value={newPassword} 
              onChange={(e) => setNewPassword(e.target.value)}
              className="mb-4"
            />
          </div>
          <div>
            <label className="block font-bold mb-1">Confirm New Password</label>
            <input 
              type="password" 
              placeholder="Re-enter your new password" 
              value={confirmNewPassword} 
              onChange={(e) => setConfirmNewPassword(e.target.value)}
              className="mb-4"
            />
          </div>
          {changeMsg && (
            <div className={`p-2.5 my-2.5 rounded ${changeMsg.includes('success') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{changeMsg}</div>
          )}
          <button onClick={handleForcePasswordChange} className="btn-success mb-2.5">
            Set New Password
          </button>
          <button onClick={logout} className="btn-secondary">
            Logout
          </button>
        </div>
      );
    }

    if (user.role === 'admin') {
      return <AdminDashboard user={user} logout={logout} token={token} />;
    }
    if (user.role === 'organizer') {
      return <OrganizerDashboard user={user} token={token} logout={logout} />;
    }
    return <Dashboard user={user} token={token} logout={logout} refreshUser={loadUser} />;
  }

  return (
    <div className="container">
      <h1>{showRegister ? 'Register' : 'Login'}</h1>
      
      {showRegister ? (
        <RegisterForm />
      ) : (
        <LoginForm setToken={setToken} setUser={(u) => {
          setUser(u);
          if (u?.mustChangePassword) setForceChangePassword(true);
        }} />
      )}

      <button 
        onClick={() => setShowRegister(!showRegister)}
        className="btn-secondary"
      >
        {showRegister ? 'Have an account? Login' : 'Need an account? Register'}
      </button>
    </div>
  );
}

export default App;
