import React from 'react';
function Navbar({ currentPage, setPage, logout }) {
  const btnClass = (active) =>
    `tab-btn ${active ? 'tab-btn-active' : 'tab-btn-inactive'}`;
  return (
    <nav className="flex items-center gap-2 flex-wrap bg-white border-b border-gray-200 px-4 py-3 mb-5 rounded-lg">
      <button className={btnClass(currentPage === 'dashboard')} onClick={() => setPage('dashboard')}>Dashboard</button>
      <button className={btnClass(currentPage === 'browse')} onClick={() => setPage('browse')}>Browse Events</button>
      <button className={btnClass(currentPage === 'clubs')} onClick={() => setPage('clubs')}>Clubs/Organizers</button>
      <button className={btnClass(currentPage === 'profile')} onClick={() => setPage('profile')}>Profile</button>
      <button onClick={logout} className="btn-danger ml-auto">Logout</button>
    </nav>
  );
}
export default Navbar;
