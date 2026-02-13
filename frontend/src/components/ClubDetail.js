import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function ClubDetail({ token, clubId, onBack, onSelectEvent }) {
  const [club, setClub] = useState(null);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('upcoming');

  useEffect(() => { loadClub(); }, [clubId]);

  const loadClub = async () => {
    try {
      const [clubRes, followRes] = await Promise.all([
        fetch(`${API_URL}/browse/club/${clubId}`),
        fetch(`${API_URL}/browse/club/${clubId}/following`, { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      const clubData = await clubRes.json();
      const followData = await followRes.json();
      
      setClub(clubData.club);
      setUpcomingEvents(clubData.upcomingEvents || []);
      setPastEvents(clubData.pastEvents || []);
      setFollowing(followData.following);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const toggleFollow = async () => {
    try {
      const res = await fetch(`${API_URL}/browse/club/${clubId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setFollowing(data.following);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!club) return <p>Club not found</p>;

  const events = tab === 'upcoming' ? upcomingEvents : pastEvents;

  return (
    <div>
      <button onClick={onBack} className="btn-secondary mb-4">← Back</button>
      
      <div className="flex justify-between items-start">
        <div>
          <h2>{club.organizationName}</h2>
          <p><strong>Category:</strong> {club.category || 'General'}</p>
          <p><strong>Contact Email:</strong> {club.contactEmail || club.email}</p>
          <p>{club.description || 'No description available'}</p>
        </div>
        <button onClick={toggleFollow} className={following ? 'btn-danger' : 'btn-primary'}>
          {following ? 'Unfollow' : 'Follow'}
        </button>
      </div>

      <hr />

      <div className="mb-4">
        <button onClick={() => setTab('upcoming')} className={`tab-btn mr-2 ${tab === 'upcoming' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
          Upcoming ({upcomingEvents.length})
        </button>
        <button onClick={() => setTab('past')} className={`tab-btn ${tab === 'past' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
          Past ({pastEvents.length})
        </button>
      </div>

      {events.length === 0 ? <p>No {tab} events</p> : (
        events.map(event => (
          <div key={event._id} onClick={() => onSelectEvent(event._id)} className="border border-gray-300 p-3 mb-3 rounded-md cursor-pointer">
            <strong>{event.eventName}</strong> <span className="text-gray-500">({event.eventType})</span>
            <p>{new Date(event.eventStartDate).toLocaleDateString()}</p>
          </div>
        ))
      )}
    </div>
  );
}

export default ClubDetail;
