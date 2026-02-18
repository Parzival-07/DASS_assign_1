// clubs listing page with follow and unfollow functionality
import React, { useState, useEffect } from 'react';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

function ClubsPage({ token, onSelectClub }) {
  const [clubs, setClubs] = useState([]);
  const [following, setFollowing] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadClubs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadClubs = async () => {
    try {
      const res = await fetch(`${API_URL}/browse/clubs`);
      const data = await res.json();
      setClubs(data.clubs || []);

      const followStatus = {};
      for (const club of data.clubs || []) {
        const fRes = await fetch(`${API_URL}/browse/club/${club._id}/following`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const fData = await fRes.json();
        followStatus[club._id] = fData.following;
      }
      setFollowing(followStatus);
      setLoading(false);
    } catch (err) {
      setLoading(false);
    }
  };

  const toggleFollow = async (clubId) => {
    try {
      const res = await fetch(`${API_URL}/browse/club/${clubId}/follow`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setFollowing({ ...following, [clubId]: data.following });
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading clubs...</p>;

  return (
    <div>
      <h3>Clubs / Organizers</h3>
      {clubs.length === 0 ? <p>No clubs available</p> : (
        clubs.map(club => (
          <div key={club._id} className="border border-gray-300 p-4 mb-3 rounded-md">
            <div className="flex justify-between items-center">
              <div onClick={() => onSelectClub(club._id)} className="cursor-pointer">
                <h4 className="m-0 text-blue-600">{club.organizationName}</h4>
                <p className="my-1 text-gray-500">{club.category || 'General'}</p>
                <p className="m-0">{club.description || 'No description'}</p>
              </div>
              <button onClick={() => toggleFollow(club._id)} className={following[club._id] ? 'btn-danger' : 'btn-primary'}>
                {following[club._id] ? 'Unfollow' : 'Follow'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export default ClubsPage;
