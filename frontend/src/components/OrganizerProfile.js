import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function OrganizerProfile({ token }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  
  const [organizationName, setOrganizationName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [discordWebhook, setDiscordWebhook] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/organizer/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProfile(data);
      setOrganizationName(data.organizationName || '');
      setCategory(data.category || '');
      setDescription(data.description || '');
      setContactEmail(data.contactEmail || '');
      setContactNumber(data.contactNumber || '');
      setDiscordWebhook(data.discordWebhook || '');
    } catch (err) {
      console.error('Error loading profile');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/organizer/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organizationName, category, description, contactEmail, contactNumber, discordWebhook })
      });
      const data = await res.json();
      setMessage(data.message || 'Profile updated');
    } catch (err) {
      setMessage('Error updating profile');
    }
  };

  const testWebhook = async () => {
    if (!discordWebhook) {
      setMessage('Please enter a Discord webhook URL first');
      return;
    }
    try {
      await fetch(discordWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'Test message from Event Management System!' })
      });
      setMessage('Test message sent to Discord!');
    } catch (err) {
      setMessage('Failed to send test message. Check webhook URL.');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Organization Profile</h2>
      
      {message && <div className={message.includes('Error') || message.includes('Failed') ? 'error' : 'success'}>{message}</div>}
      
      <div className="bg-gray-100 p-4 mb-4">
        <p><strong>Login Email:</strong> {profile?.email} (cannot be changed)</p>
      </div>

      <form onSubmit={handleSubmit}>
        <label>Organization Name</label>
        <input type="text" value={organizationName} onChange={e => setOrganizationName(e.target.value)} required />
        
        <label>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} required>
          <option value="">Select Category</option>
          <option value="Technical">Technical</option>
          <option value="Cultural">Cultural</option>
          <option value="Sports">Sports</option>
          <option value="Literary">Literary</option>
          <option value="Social">Social</option>
          <option value="Other">Other</option>
        </select>
        
        <label>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows="3" />
        
        <label>Contact Email</label>
        <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Public contact email" />
        
        <label>Contact Number</label>
        <input type="tel" value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="Contact number" />
        
        <hr />
        
        <h3>Discord Integration</h3>
        <p className="text-gray-500 text-sm">Add a Discord webhook URL to auto-post new events to your Discord server.</p>
        
        <label>Discord Webhook URL</label>
        <input type="url" value={discordWebhook} onChange={e => setDiscordWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
        
        <button type="button" onClick={testWebhook} className="btn-secondary mt-2">Test Webhook</button>
        
        <hr />
        
        <button type="submit" className="btn-success">Save Profile</button>
      </form>
    </div>
  );
}

export default OrganizerProfile;
