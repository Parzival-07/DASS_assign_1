// main student dashboard with page navigation and onboarding
import React, { useState } from 'react';
import Navbar from './Navbar';
import OnboardingForm from './OnboardingForm';
import MyEvents from './MyEvents';
import BrowseEvents from './BrowseEvents';
import EventDetails from './EventDetails';
import ClubsPage from './ClubsPage';
import ClubDetail from './ClubDetail';
import ProfilePage from './ProfilePage';
import TicketView from './TicketView';

function Dashboard({ user, token, logout, refreshUser }) {
  const [showOnboarding, setShowOnboarding] = useState(!user.onboardingComplete);
  const [page, setPage] = useState('dashboard');
  const [selectedEventId, setSelectedEventId] = useState(null);
  const [selectedClubId, setSelectedClubId] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    if (refreshUser) refreshUser();
  };

  if (showOnboarding && (user.role === 'iiit-student' || user.role === 'non-iiit-student')) {
    return (
      <div className="container">
        <h1>Welcome, {user.firstName} {user.lastName}!</h1>
        <p>Let's personalize your experience</p>
        <OnboardingForm token={token} onComplete={handleOnboardingComplete} />
      </div>
    );
  }

  if (selectedEventId) {
    return (
      <div className="container">
        <EventDetails token={token} eventId={selectedEventId} user={user} onBack={() => setSelectedEventId(null)} />
      </div>
    );
  }

  if (selectedTicketId) {
    return (
      <div className="container">
        <TicketView token={token} ticketId={selectedTicketId} onBack={() => setSelectedTicketId(null)} />
      </div>
    );
  }

  if (selectedClubId) {
    return (
      <div className="container">
        <ClubDetail token={token} clubId={selectedClubId} onBack={() => setSelectedClubId(null)} onSelectEvent={setSelectedEventId} />
      </div>
    );
  }

  return (
    <div className="container">
      <Navbar currentPage={page} setPage={setPage} logout={logout} />

      {page === 'dashboard' && (
        <div>
          <h2>Welcome, {user.firstName} {user.lastName}!</h2>
          <p>Role: {user.role}</p>
          {user.collegeName && <p>College: {user.collegeName}</p>}
          {user.areasOfInterest?.length > 0 && <p>Interests: {user.areasOfInterest.join(', ')}</p>}
          <hr />
          <MyEvents token={token} user={user} onViewTicket={setSelectedTicketId} />
        </div>
      )}

      {page === 'browse' && (
        <BrowseEvents token={token} onSelectEvent={setSelectedEventId} />
      )}

      {page === 'clubs' && (
        <ClubsPage token={token} onSelectClub={setSelectedClubId} />
      )}

      {page === 'profile' && (
        <ProfilePage token={token} user={user} onBack={() => setPage('dashboard')} refreshUser={refreshUser} />
      )}
    </div>
  );
}

export default Dashboard;
