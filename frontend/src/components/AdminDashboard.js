// admin dashboard component for managing organizers and system settings
import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function AdminDashboard({ user, logout, token }) {
  // state variables for page navigation and organizer management
  const [page, setPage] = useState('dashboard');
  const [organizers, setOrganizers] = useState([]);
  const [stats, setStats] = useState({});
  const [showArchived, setShowArchived] = useState(false);

  const [orgName, setOrgName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [generatedCredentials, setGeneratedCredentials] = useState(null);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [resetRequests, setResetRequests] = useState([]);
  const [resetFilter, setResetFilter] = useState('pending');
  const [approveComment, setApproveComment] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [generatedResetPassword, setGeneratedResetPassword] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // load data based on which page tab is currently active
  useEffect(() => {
    if (page === 'dashboard') loadStats();
    if (page === 'organizers') loadOrganizers();
    if (page === 'password') loadUsersForReset();
    if (page === 'reset-requests') loadResetRequests();
  }, [page, showArchived, resetFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch system statistics from the admin stats endpoint
  const loadStats = async () => {
    try {
      const res = await fetch(`${API_URL}/admin/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Error loading stats');
    }
  };

  const loadOrganizers = async () => {
    try {
      const url = showArchived ? `${API_URL}/admin/organizers?archivedOnly=true` : `${API_URL}/admin/organizers`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setOrganizers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading organizers');
    }
  };

  const loadUsersForReset = async () => {
    try {
      const res = await fetch(`${API_URL}/password/users-list`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Error loading users');
    }
  };

  const loadResetRequests = async () => {
    try {
      const res = await fetch(`${API_URL}/reset-request/all-requests?status=${resetFilter}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setResetRequests(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading reset requests');
    }
  };

  // approve a password reset request and generate a new password
  const handleApproveRequest = async (requestId) => {
    setError(''); setSuccess(''); setGeneratedResetPassword(null);
    try {
      const res = await fetch(`${API_URL}/reset-request/approve/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ comment: approveComment })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Approved! New password for ${data.organizerEmail}: ${data.newPassword}`);
        setGeneratedResetPassword({ email: data.organizerEmail, password: data.newPassword });
        setApproveComment('');
        loadResetRequests();
      } else {
        setError(data.message || 'Failed to approve');
      }
    } catch (err) {
      setError('Error approving request');
    }
  };

  const handleRejectRequest = async (requestId) => {
    if (!rejectComment.trim()) { setError('Please provide a reason for rejection'); return; }
    setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_URL}/reset-request/reject/${requestId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ comment: rejectComment })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Request rejected');
        setRejectComment('');
        loadResetRequests();
      } else {
        setError(data.message || 'Failed to reject');
      }
    } catch (err) {
      setError('Error rejecting request');
    }
  };

  // create a new organizer with manual or auto generated credentials
  const handleCreateOrganizer = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setGeneratedCredentials(null);

    try {
      const body = { organizationName: orgName, category, description, autoGenerate };
      if (!autoGenerate) {
        body.email = email;
        body.password = password;
      }

      const res = await fetch(`${API_URL}/admin/create-organizer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (data.organizer) {
        setSuccess('Organizer created successfully!');
        if (data.credentials) {
          setGeneratedCredentials(data.credentials);
        }
        setOrgName('');
        setCategory('');
        setDescription('');
        setEmail('');
        setPassword('');
        loadOrganizers();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Server error');
    }
  };

  // toggle active or disabled status of an organizer
  const toggleOrganizerStatus = async (id, currentStatus) => {
    try {
      const res = await fetch(`${API_URL}/admin/organizer/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ isActive: !currentStatus })
      });
      const data = await res.json();
      setSuccess(data.message);
      loadOrganizers();
    } catch (err) {
      setError('Error updating status');
    }
  };

  const archiveOrganizer = async (id) => {
    if (!window.confirm('Archive this organizer? They will not be able to login.')) return;
    try {
      const res = await fetch(`${API_URL}/admin/organizer/${id}/archive`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSuccess(data.message);
      loadOrganizers();
    } catch (err) {
      setError('Error archiving organizer');
    }
  };

  const restoreOrganizer = async (id) => {
    try {
      const res = await fetch(`${API_URL}/admin/organizer/${id}/restore`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setSuccess(data.message);
      loadOrganizers();
    } catch (err) {
      setError('Error restoring organizer');
    }
  };

  const deleteOrganizer = async (id) => {
    if (!window.confirm('Permanently delete this organizer and ALL associated data (events, registrations, teams, chats)? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API_URL}/admin/organizer/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(data.message);
        loadOrganizers();
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Error deleting organizer');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_URL}/password/admin-reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId: selectedUser, newPassword })
      });
      const data = await res.json();
      setSuccess(data.message);
      setSelectedUser('');
      setNewPassword('');
    } catch (err) {
      setError('Error resetting password');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
  };

  // navigation bar with tabs for dashboard sections
  const Navbar = () => (
    <div className="flex items-center gap-2 flex-wrap bg-white border-b border-gray-200 px-4 py-3 mb-5 rounded-lg">
      <strong className="mr-5">Admin Panel</strong>
      <button onClick={() => setPage('dashboard')} className={page === 'dashboard' ? 'btn-primary' : 'btn-secondary'}>Dashboard</button>
      <button onClick={() => setPage('organizers')} className={page === 'organizers' ? 'btn-primary' : 'btn-secondary'}>Manage Clubs/Organizers</button>
      <button onClick={() => setPage('password')} className={page === 'password' ? 'btn-primary' : 'btn-secondary'}>Password Reset</button>
      <button onClick={() => setPage('reset-requests')} className={page === 'reset-requests' ? 'btn-primary' : 'btn-secondary'}>Reset Requests</button>
      <button onClick={logout} className="btn-danger ml-auto">Logout</button>
    </div>
  );

  return (
    <div className="container">
      <Navbar />

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      {/* dashboard page showing system statistics */}
      {page === 'dashboard' && (
        <>
          <h2>Dashboard</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            <div className="stat-card bg-blue-100">
              <h3 className="m-0">{stats.totalOrganizers || 0}</h3>
              <p className="m-0">Total Organizers</p>
            </div>
            <div className="stat-card bg-green-100">
              <h3 className="m-0">{stats.activeOrganizers || 0}</h3>
              <p className="m-0">Active</p>
            </div>
            <div className="stat-card bg-red-100">
              <h3 className="m-0">{stats.disabledOrganizers || 0}</h3>
              <p className="m-0">Disabled</p>
            </div>
            <div className="stat-card bg-orange-100">
              <h3 className="m-0">{stats.totalParticipants || 0}</h3>
              <p className="m-0">Participants</p>
            </div>
            <div className="stat-card bg-purple-100">
              <h3 className="m-0">{stats.totalEvents || 0}</h3>
              <p className="m-0">Total Events</p>
            </div>
          </div>

          <p>Welcome, {user.email}</p>
          <p className="text-gray-500">Use the navigation above to manage organizers and reset passwords.</p>
        </>
      )}


      {/* organizer management page with create form and list */}
      {page === 'organizers' && (
        <>
          <h2>Add New Club/Organizer</h2>

          <form onSubmit={handleCreateOrganizer}>
            <input type="text" placeholder="Organization Name *" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="">Select Category *</option>
              <option value="Technical">Technical</option>
              <option value="Cultural">Cultural</option>
              <option value="Sports">Sports</option>
              <option value="Literary">Literary</option>
              <option value="Social">Social</option>
              <option value="Other">Other</option>
            </select>
            <textarea placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows="2" />

            <label className="flex items-center gap-2.5 my-2.5">
              <input type="checkbox" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />
              Auto-generate login credentials
            </label>

            {!autoGenerate && (
              <>
                <input type="email" placeholder="Email *" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input type="password" placeholder="Password *" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </>
            )}

            <button type="submit" className="btn-success">Create Organizer</button>
          </form>

          {generatedCredentials && (
            <div className="bg-green-100 p-4 my-4 border border-green-500 rounded-md">
              <h4 className="mt-0 mb-2.5">Generated Credentials (Share with organizer)</h4>
              <p><strong>Email:</strong> {generatedCredentials.email}
                <button onClick={() => copyToClipboard(generatedCredentials.email)} className="btn-secondary ml-2.5 px-2 py-0.5 text-sm">Copy</button>
              </p>
              <p><strong>Password:</strong> {generatedCredentials.password}
                <button onClick={() => copyToClipboard(generatedCredentials.password)} className="btn-secondary ml-2.5 px-2 py-0.5 text-sm">Copy</button>
              </p>
              <button onClick={() => copyToClipboard(`Email: ${generatedCredentials.email}\nPassword: ${generatedCredentials.password}`)} className="btn-primary">Copy Both</button>
            </div>
          )}

          <hr />

          <div className="flex justify-between items-center mb-4">
            <h2 className="m-0">Existing Organizers</h2>
            <label>
              <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
              Show Archived
            </label>
          </div>

          {organizers.length === 0 ? (
            <p>No organizers found.</p>
          ) : (
            organizers.map(org => (
              <div key={org._id} className={`border border-gray-300 p-4 my-2.5 rounded-md ${org.isArchived ? 'bg-gray-100' : (org.isActive ? 'bg-white' : 'bg-orange-100')}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="m-0">
                      {org.organizationName}
                      {org.isArchived && <span className="text-gray-400 text-xs ml-2.5">(Archived)</span>}
                      {!org.isArchived && !org.isActive && <span className="text-orange-500 text-xs ml-2.5">(Disabled)</span>}
                    </h4>
                    <p className="my-1 text-gray-500">{org.category || 'Uncategorized'}</p>
                    <p className="my-1">{org.email}</p>
                    {org.description && <p className="my-1 text-sm text-gray-500">{org.description}</p>}
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {org.isArchived ? (
                      <>
                        <button onClick={() => restoreOrganizer(org._id)} className="btn-success">Restore</button>
                        <button onClick={() => deleteOrganizer(org._id)} className="btn-danger">Delete Permanently</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => toggleOrganizerStatus(org._id, org.isActive)} className={org.isActive ? 'btn-secondary' : 'btn-success'}>
                          {org.isActive ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => archiveOrganizer(org._id)} className="btn-danger">Archive</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {page === 'password' && (
        <>
          <h2>Reset User Password</h2>
          <p className="text-gray-500">Select a user and set a new password for them.</p>

          <form onSubmit={handlePasswordReset}>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} required>
              <option value="">Select User</option>
              {users.map(u => (
                <option key={u._id} value={u._id}>
                  {u.email} - {u.role} {u.organizationName ? `(${u.organizationName})` : (u.firstName ? `(${u.firstName} ${u.lastName})` : '')}
                </option>
              ))}
            </select>
            <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
            <button type="submit" className="btn-success">Reset Password</button>
          </form>
        </>
      )}

      {/* reset requests page for reviewing organizer password reset requests */}
      {page === 'reset-requests' && (
        <>
          <h2>Organizer Password Reset Requests</h2>
          <p className="text-gray-500">Organizers request password resets here. Approve to auto-generate a new password.</p>

          {generatedResetPassword && (
            <div className="bg-green-100 p-4 my-4 border border-green-600 rounded-md">
              <h4 className="mt-0 mb-2.5">New Password Generated</h4>
              <p><strong>Organizer:</strong> {generatedResetPassword.email}</p>
              <p><strong>New Password:</strong>{' '}
                <code className="bg-white px-2 py-1 text-base tracking-wide">{generatedResetPassword.password}</code>
                <button onClick={() => copyToClipboard(generatedResetPassword.password)} className="btn-secondary ml-2.5 px-2.5 py-1 text-sm">Copy</button>
              </p>
              <p className="text-xs text-gray-500 mt-2.5 mb-0">Share this password securely with the organizer.</p>
            </div>
          )}

          <div className="flex gap-2 my-4">
            {['pending', 'approved', 'rejected'].map(f => (
              <button key={f} onClick={() => setResetFilter(f)}
                className={`px-4 py-1.5 border-none cursor-pointer rounded ${resetFilter === f
                    ? `${f === 'pending' ? 'bg-yellow-500' : f === 'approved' ? 'bg-green-600' : 'bg-red-600'} text-white font-bold`
                    : 'bg-gray-200 text-gray-800 font-normal'
                  }`}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>

          {resetRequests.length === 0 ? (
            <p className="text-gray-500">No {resetFilter} requests.</p>
          ) : (
            resetRequests.map((r) => (
              <div key={r._id} className={`border border-gray-300 p-4 my-2.5 rounded-md border-l-4 ${r.status === 'approved' ? 'border-l-green-600' : r.status === 'rejected' ? 'border-l-red-600' : 'border-l-yellow-500'
                }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="mt-0 mb-1">{r.organizerId?.organizationName || 'Unknown Club'}</h4>
                    <p className="my-0.5 text-gray-500 text-sm">{r.organizerId?.email} • {r.organizerId?.category}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${r.status === 'approved' ? 'bg-green-600' : r.status === 'rejected' ? 'bg-red-600' : 'bg-yellow-500'
                    }`}>{r.status.toUpperCase()}</span>
                </div>

                <p className="mt-2.5 mb-1"><strong>Reason:</strong> {r.reason}</p>
                <p className="my-0.5 text-xs text-gray-400">Submitted: {new Date(r.createdAt).toLocaleString()}</p>
                {r.adminComment && <p className="my-1 text-gray-600"><strong>Admin Comment:</strong> {r.adminComment}</p>}
                {r.reviewedAt && <p className="my-0.5 text-xs text-gray-400">Reviewed: {new Date(r.reviewedAt).toLocaleString()}</p>}
                {r.status === 'approved' && (
                  <p className="my-1 text-green-700 text-sm">Password was generated and shared at approval time.</p>
                )}

                {r.status === 'pending' && (
                  <div className="mt-3 p-3 bg-gray-100 rounded">
                    <div className="mb-2.5">
                      <input type="text" placeholder="Comment (optional for approve, required for reject)"
                        value={approveComment} onChange={(e) => { setApproveComment(e.target.value); setRejectComment(e.target.value); }}
                        className="text-gray-800 bg-white border border-gray-300 w-full mb-2" />
                      <div className="flex gap-2">
                        <button onClick={() => handleApproveRequest(r._id)} className="btn-success">Approve & Generate Password</button>
                        <button onClick={() => handleRejectRequest(r._id)} className="btn-danger">Reject</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
