import React, { useState, useEffect } from 'react';
import { setPreferences, skipOnboarding, getInterestAreas, getOrganizersToFollow } from '../services/api';

function OnboardingForm({ token, onComplete }) {
  const [step, setStep] = useState(1); // Step 1: Interests, Step 2: Clubs
  const [interestAreas, setInterestAreas] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedClubs, setSelectedClubs] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [interestsData, organizersData] = await Promise.all([
        getInterestAreas(),
        getOrganizersToFollow(token)
      ]);
      
      if (interestsData.interestAreas) {
        setInterestAreas(interestsData.interestAreas);
      }
      if (organizersData.organizers) {
        setOrganizers(organizersData.organizers);
      }
      setLoading(false);
    } catch (err) {
      setError('Failed to load data');
      setLoading(false);
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

  const goToClubs = () => {
    setStep(2);
  };

  const goBack = () => {
    setStep(1);
  };

  const savePreferences = async () => {
    try {
      const data = await setPreferences(token, selectedInterests, selectedClubs);
      if (data.message) {
        onComplete();
      } else {
        setError(data.message || 'Failed to save preferences');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
  };

  const handleSkip = async () => {
    try {
      const data = await skipOnboarding(token);
      if (data.message) {
        onComplete();
      } else {
        setError(data.message || 'Failed to skip onboarding');
      }
    } catch (err) {
      setError('Server error. Please try again.');
    }
  };

  if (loading) {
    return <div><h3>Loading...</h3></div>;
  }

  if (step === 1) {
    return (
      <div>
        <h3>Step 1: Select Your Areas of Interest</h3>
        {error && <div className="error">{error}</div>}
        
        <div className="mb-4">
          {interestAreas.map(area => (
            <label key={area} className="block mb-1">
              <input
                type="checkbox"
                checked={selectedInterests.includes(area)}
                onChange={() => toggleInterest(area)}
              />
              {' '}{area}
            </label>
          ))}
        </div>

        <button onClick={goToClubs} className="btn-primary">NEXT: SELECT CLUBS</button>
        <button onClick={handleSkip} className="btn-secondary">SKIP FOR NOW</button>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div>
        <h3>Step 2: Follow Clubs/Organizers</h3>
        {error && <div className="error">{error}</div>}
        
        <div className="mb-4">
          {organizers.length === 0 ? (
            <p>No clubs available yet</p>
          ) : (
            organizers.map(org => (
              <label key={org._id} className="block mb-1">
                <input
                  type="checkbox"
                  checked={selectedClubs.includes(org._id)}
                  onChange={() => toggleClub(org._id)}
                />
                {' '}{org.organizationName} ({org.category || 'General'})
              </label>
            ))
          )}
        </div>

        <button onClick={savePreferences} className="btn-success">COMPLETE ONBOARDING</button>
        <button onClick={goBack} className="btn-secondary">BACK</button>
        <button onClick={handleSkip} className="btn-secondary">SKIP FOR NOW</button>
      </div>
    );
  }
}

export default OnboardingForm;
