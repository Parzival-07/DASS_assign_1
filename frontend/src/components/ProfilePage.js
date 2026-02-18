// user profile page for managing personal info preferences and password
import React, { useState, useEffect } from 'react';
import { getUserProfile, updateProfile, setPreferences, getInterestAreas, getOrganizersToFollow } from '../services/api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function ProfilePage({ token, user, onBack, refreshUser }) {
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [collegeName, setCollegeName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [interestAreas, setInterestAreas] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState([]);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
    loadPreferencesData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // load user profile data and set form fields with current values
  const loadProfile = async () => {
    try {
      const data = await getUserProfile(token);
      setProfile(data);
      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
      setCollegeName(data.collegeName || '');
      setContactNumber(data.contactNumber || '');
      setSelectedInterests(data.areasOfInterest || []);
      setSelectedClubs(data.followingClubs?.map(c => c._id) || []);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  // load available interest areas and organizers for preference selection
  const loadPreferencesData = async () => {
    try {
      const [interestsData, organizersData] = await Promise.all([
        getInterestAreas(),
        getOrganizersToFollow(token)
      ]);
      setInterestAreas(interestsData.interestAreas || []);
      setOrganizers(organizersData.organizers || []);
    } catch (err) {
      console.error('Error loading preferences data');
    }
  };

  // update user personal information on the server
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await updateProfile(token, { firstName, lastName, collegeName, contactNumber });
      setMessage('Profile updated successfully!');
      if (refreshUser) refreshUser();
    } catch (err) {
      setMessage('Error updating profile');
    }
  };

  const handleUpdatePreferences = async () => {
    try {
      await setPreferences(token, selectedInterests, selectedClubs);
      setMessage('Preferences updated successfully!');
      if (refreshUser) refreshUser();
    } catch (err) {
      setMessage('Error updating preferences');
    }
  };

  // change user password with current password verification
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match');
      return;
    }
    try {
      const res = await fetch(`${API_URL}/password/change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      setMessage(data.message);
      if (res.ok) {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      setMessage('Error changing password');
    }
  };

  const toggleInterest = (interest) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(i => i !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const toggleClub = (clubId) => {
    if (selectedClubs.includes(clubId)) {
      setSelectedClubs(selectedClubs.filter(c => c !== clubId));
    } else {
      setSelectedClubs([...selectedClubs, clubId]);
    }
  };

  if (loading) return <p>Loading profile...</p>;

  const isIIIT = user?.role === 'iiit-student';

  return (
    <div>
      <h2>My Profile</h2>
      {message && <div className={message.includes('Error') || message.includes('match') ? 'error' : 'success'}>{message}</div>}

      <div className="bg-gray-100 p-4 mb-4 rounded-md">
        <p><strong>Email:</strong> {profile?.email} (cannot be changed)</p>
        <p><strong>Participant Type:</strong> {isIIIT ? 'IIIT Student' : 'Non-IIIT Student'} (cannot be changed)</p>
      </div>

      <h3>Personal Information</h3>
      <form onSubmit={handleUpdateProfile}>
        <input type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        <input type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        {!isIIIT && <input type="text" placeholder="College Name" value={collegeName} onChange={(e) => setCollegeName(e.target.value)} />}
        {isIIIT && <p><strong>College:</strong> IIIT</p>}
        <input type="tel" placeholder="Contact Number" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
        <button type="submit" className="btn-success">Update Profile</button>
      </form>

      <hr />

      <h3>My Interests</h3>
      <div className="mb-4">
        {interestAreas.map(area => (
          <label key={area}>
            <input type="checkbox" checked={selectedInterests.includes(area)} onChange={() => toggleInterest(area)} />
            {area}
          </label>
        ))}
      </div>

      <h3>Following Clubs</h3>
      <div className="mb-4">
        {organizers.map(org => (
          <label key={org._id}>
            <input type="checkbox" checked={selectedClubs.includes(org._id)} onChange={() => toggleClub(org._id)} />
            {org.organizationName} ({org.category || 'General'})
          </label>
        ))}
      </div>
      <button onClick={handleUpdatePreferences} className="btn-success">Update Preferences</button>

      <hr />

      <h3>Change Password</h3>
      <form onSubmit={handleChangePassword}>
        <input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        <input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        <button type="submit" className="btn-primary">Change Password</button>
      </form>

      <hr />

      <button onClick={onBack} className="btn-secondary">Back to Dashboard</button>
    </div>
  );
}

export default ProfilePage;
