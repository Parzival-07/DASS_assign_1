# Event Management System - DASS Assignment 1

A comprehensive MERN stack event management platform for IIIT colleges, supporting event registration, team-based hackathons, QR-based attendance tracking, and real-time team collaboration.

---

## Table of Contents
1. [Technology Stack & Justification](#technology-stack--justification)
2. [Advanced Features Implemented](#advanced-features-implemented)
3. [Feature Design & Implementation](#feature-design--implementation)
4. [Architecture & Technical Decisions](#architecture--technical-decisions)
5. [Setup & Installation](#setup--installation)
6. [Project Structure](#project-structure)
7. [API Documentation](#api-documentation)

---

## Technology Stack & Justification

### Backend Technologies

#### 1. **Node.js & Express.js**
- **Why chosen**: 
  - Non-blocking I/O architecture ideal for real-time features (team chat, attendance tracking)
  - JavaScript across full stack reduces context switching
  - Massive npm ecosystem provides battle-tested libraries
  - Express.js provides minimalist, unopinionated framework allowing custom architecture
- **Problem solved**: Need for scalable, real-time event management with concurrent user operations

#### 2. **MongoDB with Mongoose**
- **Why chosen**:
  - Document-based model maps naturally to event data with varying custom fields
  - Flexible schema for merchandise variants (sizes, colors), custom registration forms
  - Atomic operations for critical team registration workflows
  - GridFS capability (though not used) for future file uploads
  - MongoDB Atlas provides free-tier hosting with automatic backups
- **Problem solved**: Need for flexible data modeling supporting events with different structures (normal vs merchandise, team vs individual)

#### 3. **bcrypt.js (v2.4.3)**
- **Why chosen**:
  - Industry-standard password hashing with adaptive cost factor
  - Automatic salt generation prevents rainbow table attacks
  - Synchronous operations acceptable for authentication endpoints
- **Problem solved**: Secure password storage for admin, organizers, and participants

#### 4. **jsonwebtoken (v9.0.2)**
- **Why chosen**:
  - Stateless authentication ideal for REST APIs
  - Self-contained tokens reduce database lookups
  - 7-day expiry balances security and convenience
  - Embedded user role enables immediate authorization checks
- **Problem solved**: Scalable authentication without session storage

#### 5. **Nodemailer (v6.9.16)**
- **Why chosen**:
  - Supports Gmail SMTP with OAuth2 or app passwords
  - Template-based email sending for password reset notifications
  - Automatic retry and error handling
  - Zero external email service costs (uses existing Gmail)
- **Problem solved**: Automated email notifications for password resets

#### 6. **cors (v2.8.5)**
- **Why chosen**:
  - Essential for React frontend (port 3000) to communicate with Express backend (port 5000)
  - Configurable origin whitelist for production security
  - Pre-flight request handling for PUT/DELETE methods
- **Problem solved**: Cross-origin restrictions in browser-based SPAs

#### 7. **ics (v3.8.1)**
- **Why chosen**:
  - RFC 5545 compliant .ics file generation
  - Universal calendar compatibility (Apple Calendar, Outlook, Thunderbird)
  - Simple API for event creation with VTIMEZONE support
  - Zero dependencies on external calendar APIs
- **Problem solved**: Native calendar integration without vendor lock-in

#### 8. **multer (v1.4.5)**
- **Why chosen**:
  - De-facto standard for multipart/form-data handling in Express.js
  - Disk storage engine with configurable destination and filename
  - Built-in file size limits and MIME type filtering
  - Memory-efficient streaming (no full file buffering)
- **Problem solved**: File uploads for custom registration forms (PDF, images, documents) and team chat file sharing

#### 9. **nanoid (v3.3.8)**
- **Why chosen**:
  - Collision-resistant unique IDs for tickets (TKT-XXXXXXXX) and team invite codes
  - Compact 8-character codes easy to share verbally
  - Cryptographically secure random generation
  - URL-safe character set (no confusion with similar characters)
- **Problem solved**: Human-readable, shareable codes for team invitations

### Frontend Technologies

#### 10. **React 18.2**
- **Why chosen**:
  - Component-based architecture maps to UI sections (Navbar, Dashboard, EventCard)
  - Virtual DOM enables efficient re-renders for live attendance dashboards
  - Hooks (useState, useEffect) simplify state management without Redux overhead
  - Mature ecosystem with extensive documentation
  - Automatic batching in React 18 improves performance
- **Problem solved**: Complex UI with real-time updates, multiple user roles, nested component hierarchies

#### 11. **React Router (via react-scripts)**
- **Why chosen** (implicit via Create React App):
  - Client-side routing for SPA without page reloads
  - Nested route support for dashboard/sub-pages
  - State preservation during navigation
- **Problem solved**: Multi-page experience in single-page app

#### 12. **Tailwind CSS 3.4**
- **Why chosen**:
  - **Utility-first approach**: Eliminates context switching between JS and CSS files
  - **Consistency**: Design system built-in (color palette, spacing scale)
  - **Performance**: PurgeCSS removes unused styles (4.76 KB final bundle)
  - **No naming fatigue**: No need to invent class names (BEM, OOCSS)
  - **Responsive by default**: Mobile-first breakpoint system
  - **Maintainability**: Changes are localized to component files
  - **Dark mode ready**: (not implemented but available)
- **Replaced**: 13 lines of problematic global CSS causing `display: block; width: 100%` issues on all inputs/buttons
- **Problem solved**: Rapid UI development with consistent styling, reduced CSS bloat, eliminated inline style objects (200+ converted)

#### 13. **html5-qrcode (v2.3.8)**
- **Why chosen**:
  - Pure JavaScript, no native dependencies (works on any device)
  - Multi-mode scanning: camera, file upload, manual entry
  - Front/rear camera selection
  - Handles QR malformation gracefully
  - No server-side processing required
- **Alternatives considered**:
  - `react-qr-scanner`: Requires WebRTC, less flexible
  - Native `BarcodeDetector API`: Limited browser support (Chrome only)
- **Problem solved**: QR-based attendance without mobile app installation

---

## Advanced Features Implemented

### Tier A Features

#### 1. **Hackathon Team Registration** (Tier A)
**Implementation Approach**:
- **Team Model** with 4 states: `forming` (collecting members) → `complete` (ready) → `cancelled` (disbanded) → `complete` (locked after event starts)
- **8-character alphanumeric invite codes** (nanoid) displayed prominently with copy-to-clipboard
- **Leader-controlled team creation**: Only leader can disband team; disbanding cancels all member registrations
- **Atomic team completion**: Registration status changes from `pending` → `confirmed` only when team reaches `maxSize`
- **Smart validation**:
  - Prevents joining multiple teams for same event
  - Prevents duplicate joins with same invite code
  - Rejects invalid/expired codes
  - Enforces team size limits (2-20 members)
- **Team dashboard** shows:
  - Progress bar (e.g., "3/4 members")
  - Member list with leader badge
  - Invite code display (forming only)
  - Team status indicator
- **Auto-ticket generation**: All team members receive QR tickets simultaneously when team completes

**Technical Decisions**:
- **Why atomic updates**: Used MongoDB transactions to ensure all-or-nothing registration for team completion
- **Why 8 characters**: Balances memorability vs. collision probability (208 trillion combinations)
- **Why leader-only disband**: Prevents griefing where non-leaders disband teams maliciously
- **Why separate Team model**: Decouples team logic from Registration, enables independent team analytics

**Design Choices**:
- **Expandable team panel**: Collapsed by default to avoid overwhelming UI; expands on-demand
- **Visual feedback**: Green (complete), Yellow (forming), Red (cancelled) status colors
- **Empty slot indicators**: Shows unfilled positions visually (e.g., "Member 4: Waiting...")

---

#### 2. **QR Scanner & Attendance Tracking** (Tier A)
**Implementation Approach**:
- **3-input methods**:
  1. **Live camera scan**: html5-qrcode with auto-focus, front/rear camera selection
  2. **File upload**: Accepts screenshot/photo of QR code
  3. **Manual entry**: Fallback for damaged codes or technical issues
- **QR payload**: JSON-encoded `{ ticketId, eventId, userId }` with URL encoding
- **Validation chain**:
  1. Ticket exists & belongs to this event
  2. Registration status is `confirmed` (not cancelled)
  3. Not already scanned (duplicate check)
  4. Timestamp logged with method (`qr-scan` vs `manual`)
- **Live attendance dashboard**:
  - 3-card stats: Total | Checked In (green) | Not Yet (orange)
  - Progress bar with percentage
  - Two tables: Checked In (with scan time/method) | Not Yet (with manual override button)
- **CSV export**: Includes name, email, ticket, team, attendance, timestamp, method
- **Manual override**: Requires reason input, logs as `manual` method with organizer ID
- **Audit trail**: All scans stored with timestamp, method, organizer ID (for manual)

**Technical Decisions**:
- **Why JSON in QR**: Enables client-side validation before API call (reduces invalid scan attempts)
- **Why URL encoding**: Handles special characters in user data
- **Why 3 input methods**: Camera failure is common; file upload handles screenshots; manual is final fallback
- **Why file upload in custom forms**: Organizers need to collect documents (ID proof, certificates, resumes) as part of registration. Files upload via multer to server disk, stored as URL references in registration data
- **Why file sharing in team chat**: Teams need to share code snippets, screenshots, design mockups. Images render inline, other files show as download links with size/type info
- **Why timestamp logging**: Provides forensic data for disputes ("I attended but wasn't marked")
- **Why manual override**: Handles edge cases (lost phone, QR damage) without breaking process

**Design Choices**:
- **Color-coded result screens**: Green (success), Yellow (duplicate), Red (invalid/cancelled/wrong-event)
- **Method badges**: "QR Scan" vs "Manual" distinguish automatic vs manual check-ins
- **Not-Yet list priority**: Shows who hasn't checked in for proactive follow-up
- **Export button placement**: Above tables for easy access after event

---

### Tier B Features

#### 1. **Organizer Password Reset Workflow** (Tier B)
**Implementation Approach**:
- **Request flow**:
  1. Organizer submits reason via textarea (min 5 characters)
  2. Admin sees request in "Pending" tab with club name, email, category, reason, timestamp
  3. Admin approves → system auto-generates 12-character password (uppercase, lowercase, digits)
  4. Admin receives password in UI (copyable) + organizer email notified
  5. Admin rejects → reason required, organizer notified
- **Forced password change**:
  - `mustChangePassword` flag set on User model when admin approves
  - On login, organizer sees fullscreen "Set New Password" form (cannot access dashboard)
  - Must provide temporary password (from admin) + new password + confirm
  - Flag cleared after successful change
- **Request history**: All requests (pending/approved/rejected) visible to organizer with:
  - Status badges (color-coded)
  - Admin comments
  - Approval timestamp
  - Generated password (for approved requests)
- **Duplicate prevention**: Only 1 pending request allowed per organizer

**Technical Decisions**:
- **Why auto-generate password**: Eliminates weak admin-chosen passwords, ensures randomness
- **Why force change**: Ensures admin never knows organizer's final password (security best practice)
- **Why min 5 chars for reason**: Prevents spam requests with empty/trivial reasons
- **Why show history**: Transparency for organizers, reduces repeat requests

**Design Choices**:
- **Tab-based filtering**: Pending (Yellow), Approved (Green), Rejected (Red) for quick status scanning
- **Copyable password display**: Monospace font, inline copy buttons (copy password, copy both)
- **Prominent warning on force-change screen**: Yellow banner explains why access is blocked
- **Textarea with live counter**: Shows remaining characters for reason input

---

#### 2. **Team Chat** (Tier B)
**Implementation Approach**:
- **Real-time simulation** (polling-based, not WebSocket):
  - **Message polling**: Every 3 seconds, fetches new messages since last timestamp
  - **Online status heartbeat**: Every 15 seconds, updates user's last-seen timestamp
  - **Typing indicator**: Debounced 3-second window, broadcasts typing status
- **Message types**:
  - **User messages**: Regular text messages with sender name, timestamp
  - **System messages**: Centered, gray (e.g., "John joined the team")
  - **Links**: Auto-detected (regex), rendered as clickable blue links
  - **File messages**: Upload files/images via 📎 button; images render inline, documents show as download links with size
- **UI components**:
  - **Header**: Team name, online count (green dots), close button
  - **Messages area**: Date dividers ("Today", "Yesterday", date), chat bubbles (own=purple, others=white)
  - **Typing indicator**: "{Name} is typing..." below messages
  - **Input bar**: File attachment button (📎), rounded input, send button (disabled if empty)
  - **File sharing**: Hidden file input triggered by 📎, uploads via multer, displays inline images or download links
- **Unread badges**: Red circle on "Open Team Chat" button (shows count, clears when opened)
- **Persistence**: All messages stored in ChatMessage model, retrieved on chat open

**Technical Decisions**:
- **Why polling instead of WebSocket**: Simpler infrastructure (no persistent connections), easier deployment (no Socket.io server), sufficient for team chat scale (5-10 members)
- **Why 3-second poll interval**: Balances responsiveness vs. server load (20 requests/min/team)
- **Why 15-second heartbeat**: "Online" status doesn't need millisecond precision, reduces DB writes
- **Why typing indicator**: Improves perceived responsiveness ("someone is replying")
- **Why date dividers**: Breaks up long chat history visually
- **Why separate ChatMessage model**: Isolates chat data, enables future features (search, @mentions)

**Design Choices**:
- **Purple theme**: Matches team feature branding (purple badges, buttons)
- **Bubble chat UI**: Familiar messaging app UX (WhatsApp, Telegram)
- **Relative timestamps**: "Today 3:45 PM" more readable than ISO strings
- **Auto-scroll to bottom**: New messages appear without manual scrolling
- **Rounded input**: Modern, friendly appearance vs. rectangular boxes

---

### Tier C Features

#### 1. **Add to Calendar Integration** (Tier C)
**Implementation Approach**:
- **3 export methods**:
  1. **.ics file download**: Universal format (Apple Calendar, Thunderbird, etc.)
  2. **Google Calendar link**: Direct browser navigation to Google Calendar with pre-filled form
  3. **Outlook.com link**: Opens Outlook web app with event details
- **Implementation details**:
  - **Backend .ics generation** (GET `/api/registration/calendar/:ticketId`):
    - Uses `ics` library to create RFC 5545 compliant file
    - Includes event name, description, start/end times, location (organizer name)
    - Embeds ticket ID in description for reference
    - Sets PRODID to identify source app
  - **Frontend URL generation**:
    - Google: Query params with `dates` (YYYYMMDDTHHmmss format), `text`, `details`
    - Outlook: Query params with `startdt`/`enddt` (ISO format), `subject`, `body`
  - **Date formatting**: Convert JS Date to required formats (Google uses no separators, Outlook uses ISO)
- **Placement**: Shows after registration success AND in ticket view
- **Visual design**: Blue info box with 3 buttons (.ics=teal, Google=blue, Outlook=dark-blue)

**Technical Decisions**:
- **Why server-side .ics generation**: Ensures consistent formatting, offloads processing from frontend
- **Why client-side Google/Outlook URLs**: No server needed, opens in user's browser instantly
- **Why all 3 methods**: Different users prefer different calendar apps (iOS users need .ics, Gmail users prefer Google Calendar)
- **Why embed ticket ID**: Provides reference if user needs to look up registration details later

**Design Choices**:
- **Icon prefixes**: 📥 (download), Google/Outlook logos (via text) make purpose clear
- **Small font size (text-xs)**: De-emphasizes calendar buttons vs. primary actions
- **Helper text**: ".ics works with Apple Calendar, Thunderbird, and more" educates users
- **Disabled if cancelled**: Calendar buttons don't show for cancelled registrations

---

## Architecture & Technical Decisions

### Authentication & Authorization
- **JWT in localStorage**: Persists across browser refreshes, auto-login on page reload
- **Role-based routing**: Admin → AdminDashboard, Organizer → OrganizerDashboard, Students → Dashboard
- **Token verification on mount**: Validates stored token on app load, auto-logout if expired
- **Authorization middleware**: Backend checks token + user role on every protected route

### State Management
- **Component-level state (useState)**: Sufficient for this app's complexity, no Redux overhead
- **State lifting**: Shared state (user, token) in App.js, passed as props to child components
- **Effect hooks (useEffect)**: Fetch data on component mount, refetch on user actions

### Database Design Decisions
- **Embedded vs. Referenced**:
  - **Embedded**: Event tags (array), merchandise options (object), custom form fields (array) → rarely queried independently
  - **Referenced**: User/Event in Registration, Leader in Team → enables independent updates, prevents data duplication
- **Virtual fields**: `currentRegistrations` calculated on-the-fly from Registration count
- **Indexes**: Email (unique), eventId (frequent joins), teamId (chat queries)
- **Timestamps**: `createdAt`, `updatedAt` auto-managed by Mongoose

### Security Measures
- **Password hashing**: bcrypt with 10 salt rounds (balance security vs. speed)
- **JWT expiry**: 7 days (long enough to be convenient, short enough to limit damage if stolen)
- **CORS whitelist**: Configurable allowed origins (localhost:3000 for dev, production URL for prod)
- **Environment variables**: Secrets (JWT_SECRET, MONGO_URI, email credentials) never committed to Git
- **Input validation**: Required fields, email format, date logic (deadline < start < end)

### Performance Optimizations
- **Tailwind CSS PurgeCSS**: Only 4.76 KB CSS (removed 95%+ unused styles)
- **React.memo** (not used): Could optimize list components if performance issues arise
- **Database indexes**: On frequently queried fields (email, eventId)
- **Pagination** (not implemented): Could add if event counts exceed 100+

### Error Handling
- **Try-catch blocks**: All async operations wrapped, generic "Server error" messages to frontend
- **HTTP status codes**: 200 (success), 400 (validation), 401 (unauthorized), 404 (not found), 500 (server error)
- **User-friendly messages**: "Email already registered" instead of "Duplicate key error: email_1"
- **Console logging**: Backend logs errors for debugging (should use Winston/Morgan in production)

---

## Setup & Installation

### Prerequisites
- **Node.js** 16.x or higher ([Download](https://nodejs.org/))
- **MongoDB Atlas account** (free tier) ([Sign up](https://www.mongodb.com/cloud/atlas))
- **Gmail account** with App Password enabled ([Guide](https://support.google.com/accounts/answer/185833))

### Backend Setup

1. **Navigate to backend folder**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Create `.env` file** with the following:
   ```env
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/eventmanagement
   JWT_SECRET=your_random_secret_key_minimum_32_characters
   EMAIL_USER=your-gmail@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

   **Getting MongoDB URI**:
   - Create MongoDB Atlas cluster
   - Click "Connect" → "Connect your application"
   - Copy connection string
   - Replace `<password>` with your database user password
   - Replace `<dbname>` with `eventmanagement`

   **Getting Gmail App Password**:
   - Enable 2-Factor Authentication on Gmail
   - Go to Google Account → Security → 2-Step Verification → App passwords
   - Generate password for "Mail" app
   - Copy 16-character code (no spaces)

4. **Start backend server**:
   ```bash
   node server.js
   ```
   Server runs on http://localhost:5000

5. **Verify admin seeding**:
   - Admin account auto-created on first run:
   - Email: `admin@iiit.ac.in`
   - Password: `Kavish@0`

### Frontend Setup

1. **Navigate to frontend folder** (new terminal):
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start React development server**:
   ```bash
   npm start
   ```
   App opens automatically at http://localhost:3000

4. **Login as admin**:
   - Email: `admin@iiit.ac.in`
   - Password: `Kavish@0`

### Testing the Application

#### Create a Test Organizer
1. Login as admin
2. Navigate to "Manage Clubs/Organizers"
3. Create organizer:
   - Organization Name: "Tech Club"
   - Category: Technical
   - Check "Auto-generate login credentials"
4. Copy generated email and password
5. Logout, login as organizer

#### Create a Test Event
1. As organizer, go to "Create Event"
2. Fill form:
   - Event Type: Normal Event
   - Event Name: "Hackathon 2026"
   - Eligibility: All Students
   - Registration Deadline: Tomorrow
   - Event Start: 2 days from now
   - Registration Limit: 50
   - Registration Fee: 100
3. Check "Team-Based Event"
4. Set Min Team Size: 2, Max Team Size: 4
5. Click "Publish Now"

#### Test Team Registration
1. Logout, register as new participant:
   - Email: `student1@iiit.ac.in`
   - User Type: IIIT Student
2. Browse events → Find "Hackathon 2026" → Register
3. Create team:
   - Team Name: "Code Warriors"
   - Size: 4
4. Copy invite code
5. Open incognito window, register as `student2@iiit.ac.in`
6. Browse → Hackathon → Register → Join Team → Paste code
7. Repeat for 2 more students until team complete

#### Test QR Scanner
1. Login as organizer
2. Go to "Ongoing Events" → Click event
3. Change status to "Ongoing" (scanner tab appears)
4. Open scanner tab
5. In separate tab, login as student1
6. My Events → View Ticket → Screenshot QR code
7. Back to organizer → Upload QR image
8. Verify "Attendance marked successfully"

#### Test Team Chat
1. Login as student1
2. My Events → Expand team dashboard
3. Click "Open Team Chat"
4. Send message: "Hello team!"
5. Login as student2 (different browser)
6. Open team chat → See student1's message
7. Reply to test real-time updates

---

## Project Structure

```
DASS-Ass-1/
├── backend/
│   ├── server.js                 # Express server entry point
│   ├── package.json              # Backend dependencies
│   ├── config/
│   │   ├── database.js           # MongoDB connection + admin seeding
│   │   └── email.js              # Nodemailer transporter setup
│   ├── middleware/
│   │   └── auth.js               # JWT verification middleware
│   ├── models/
│   │   ├── User.js               # Users (admin/organizer/students)
│   │   ├── Event.js              # Events (normal/merchandise)
│   │   ├── Registration.js       # Event registrations + tickets
│   │   ├── Team.js               # Hackathon teams
│   │   ├── ChatMessage.js        # Team chat messages
│   │   └── PasswordResetRequest.js  # Organizer password resets
│   ├── uploads/                  # Uploaded files (form/, chat/)
│   └── routes/
│       ├── auth.js               # Login, register, verify token
│       ├── admin.js              # Admin CRUD for organizers
│       ├── user.js               # User profile management
│       ├── event.js              # Event CRUD (organizer)
│       ├── browse.js             # Public event browsing
│       ├── registration.js       # Event registration + tickets
│       ├── team.js               # Team management
│       ├── chat.js               # Team chat endpoints
│       ├── upload.js             # File upload (multer)
│       ├── password.js           # Password change/reset
│       ├── resetRequest.js       # Password reset requests
│       └── organizer.js          # Organizer dashboard + analytics
│
├── frontend/
│   ├── package.json              # Frontend dependencies
│   ├── tailwind.config.js        # Tailwind CSS configuration
│   ├── public/
│   │   └── index.html            # HTML template
│   └── src/
│       ├── index.js              # React entry point
│       ├── index.css             # Tailwind directives + base styles
│       ├── App.js                # Root component (auth gate, routing)
│       ├── App.css               # (Empty - all styles in Tailwind)
│       ├── components/
│       │   ├── LoginForm.js      # Login UI
│       │   ├── RegisterForm.js   # 3-step registration
│       │   ├── Navbar.js         # Horizontal navigation bar
│       │   ├── Dashboard.js      # Participant shell (onboarding gate)
│       │   ├── BrowseEvents.js   # Event browsing + search/filter
│       │   ├── EventDetails.js   # Event registration (individual/team)
│       │   ├── MyEvents.js       # Participant's registrations
│       │   ├── TicketView.js     # QR ticket display
│       │   ├── ProfilePage.js    # User profile + password change
│       │   ├── OnboardingForm.js # Interests + clubs selection
│       │   ├── ClubsPage.js      # Organizers list
│       │   ├── ClubDetail.js     # Organizer profile + events
│       │   ├── AdminDashboard.js # Admin panel (organizers, resets)
│       │   ├── OrganizerDashboard.js  # Organizer panel
│       │   ├── CreateEventForm.js     # Event creation
│       │   ├── OrganizerEventDetail.js # Event management + scanner
│       │   ├── OrganizerProfile.js    # Organizer settings
│       │   ├── QRScanner.js      # QR code scanner component
│       │   └── TeamChat.js       # Team chat UI
│       └── services/
│           ├── api.js            # Auth + user API calls
│           └── eventApi.js       # Event API calls
│
├── deployment.txt                # Deployment instructions
└── README.md                     # This file
```

---

## API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register new participant account.
- **Body**: `{ email, password, firstName, lastName, role, collegeName?, contactNumber }`
- **Returns**: `{ message, user }`

#### POST `/api/auth/login`
Login with email and password.
- **Body**: `{ email, password }`
- **Returns**: `{ token, user: { id, email, role, organizationName?, mustChangePassword? } }`

#### GET `/api/auth/verify`
Verify JWT token validity.
- **Headers**: `Authorization: Bearer <token>`
- **Returns**: `{ valid: true, user: {...} }`

### Event Endpoints

#### POST `/api/events/create` (Organizer)
Create new event.
- **Body**: `{ eventName, eventType, eligibility, dates, limits, customForm?, teamBased?, minTeamSize?, maxTeamSize? }`
- **Returns**: `{ event, message }`

#### GET `/api/browse/events`
Get all published events with filters.
- **Query**: `search, type, eligibility, startDate, endDate, followedOnly, matchingInterests`
- **Returns**: `{ events: [...], trending: [...] }`

#### GET `/api/events/:id`
Get event details by ID.
- **Returns**: `{ event, organizer, isRegistered, myRegistration, canRegister }`

### Registration Endpoints

#### POST `/api/registration/register/:eventId`
Register for event (individual or team).
- **Body**: `{ teamAction: 'create' | 'join', teamName?, inviteCode?, customFormData?, merchandise? }`
- **Returns**: `{ registration, qrCode, team? }`

#### POST `/api/registration/cancel/:ticketId`
Cancel registration (disbands team if leader).
- **Returns**: `{ message }`

#### GET `/api/registration/ticket/:ticketId`
Get ticket details with QR code.
- **Returns**: `{ ticketId, eventId, userId, status, qrCode }`

#### GET `/api/registration/calendar/:ticketId`
Download .ics calendar file.
- **Returns**: `.ics file download`

### Team Endpoints

#### GET `/api/team/my-team/:eventId`
Get user's team for event.
- **Returns**: `{ team: { teamName, members, status, inviteCode, leaderId } }`

#### POST `/api/team/leave/:eventId`
Leave team (cancels registration).
- **Returns**: `{ message }`

### Chat Endpoints

#### GET `/api/chat/messages/:teamId`
Get team chat messages.
- **Query**: `since` (ISO timestamp for polling)
- **Returns**: `{ messages: [...], online: {...}, typing: [...], teamName }`

#### POST `/api/chat/send`
Send chat message to team.
- **Body**: `{ teamId, message }`
- **Returns**: `{ chatMessage }`

#### POST `/api/chat/heartbeat`
Update user's online status.
- **Body**: `{ teamId }`
- **Returns**: `{ message }`

#### POST `/api/chat/typing`
Broadcast typing indicator.
- **Body**: `{ teamId }`
- **Returns**: `{ message }`

### Admin Endpoints

#### POST `/api/admin/create-organizer`
Create organizer account.
- **Body**: `{ organizationName, category, description, autoGenerate, email?, password? }`
- **Returns**: `{ organizer, credentials?: { email, password } }`

#### PUT `/api/admin/organizer/:id/status`
Enable/disable organizer account.
- **Body**: `{ isActive: boolean }`
- **Returns**: `{ message }`

#### DELETE `/api/admin/organizer/:id`
Permanently delete organizer + all data.
- **Returns**: `{ message, deleted: { events, registrations, teams, chats } }`

### Password Reset Endpoints

#### POST `/api/reset-request/request` (Organizer)
Submit password reset request.
- **Body**: `{ reason }`
- **Returns**: `{ message }`

#### POST `/api/reset-request/approve/:requestId` (Admin)
Approve request + generate new password.
- **Body**: `{ comment? }`
- **Returns**: `{ message, newPassword, organizerEmail }`

#### POST `/api/reset-request/reject/:requestId` (Admin)
Reject request with reason.
- **Body**: `{ comment }`
- **Returns**: `{ message }`

### File Upload Endpoints

#### POST `/api/upload/file`
Upload a single file (max 10MB).
- **Body** (multipart/form-data): `file` (the file), `context` ('form' | 'chat' | 'general')
- **Returns**: `{ file: { url, originalName, size, mimetype } }`

#### POST `/api/chat/send-file`
Share a file in team chat.
- **Body** (multipart/form-data): `file` (the file), `teamId`
- **Returns**: `{ chatMessage }` (with messageType: 'file')

### Organizer Endpoints

#### GET `/api/organizer/dashboard`
Get analytics + events summary.
- **Returns**: `{ analytics: { totalEvents, totalRegistrations, totalRevenue }, events: [...] }`

#### POST `/api/organizer/event/:eventId/scan-qr`
Mark attendance via QR scan.
- **Body**: `{ ticketId, eventId, userId }` (from QR code)
- **Returns**: `{ scanResult: 'success' | 'duplicate' | 'invalid', message, participant }`

#### POST `/api/organizer/event/:eventId/manual-attendance`
Manual attendance override.
- **Body**: `{ registrationId, reason }`
- **Returns**: `{ message }`

#### GET `/api/organizer/event/:eventId/attendance-stats`
Get live attendance statistics.
- **Returns**: `{ total, scanned, notScanned, scannedList: [...], notScannedList: [...] }`

---

## Additional Notes

### Browser Compatibility
- **Recommended**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **QR Scanner**: Requires camera permissions (HTTPS required in production)
- **LocalStorage**: Used for JWT persistence (no IE11 support)

### Known Limitations
- **Chat is polling-based**: Not true real-time (3-second delay); WebSocket would be better for production
- **No pagination**: All events/registrations loaded at once (fine for <1000 events)
- **No email verification**: Users can register with any email (should add OTP verification)
- **No rate limiting**: Backend has no request throttling (should add express-rate-limit)
- **No admin password change**: Admin password is hardcoded (should add password change flow)
- **Mobile responsiveness**: Tailwind provides breakpoints, but not fully optimized for <375px screens

### Future Enhancements
- **Push notifications**: Browser notifications for new messages, event reminders
- **Event banner images**: Allow organizers to upload banner images for events
- **Payment integration**: Razorpay/Stripe for online registration fees
- **Analytics dashboard**: Charts for registration trends, attendance rates
- **Email templates**: HTML emails with branding, event details
- **Multi-language support**: i18n for Hindi/regional languages
- **Dark mode**: Tailwind dark: variant already available



---

## References
 

**Libraries Used**:
- React 18.2 - https://react.dev
- Express.js 4.21 - https://expressjs.com
- MongoDB with Mongoose 8.8 - https://mongoosejs.com
- Tailwind CSS 3.4 - https://tailwindcss.com
- html5-qrcode 2.3.8 - https://github.com/mebjas/html5-qrcode
- bcrypt.js 2.4.3 - https://github.com/dcodeIO/bcrypt.js
- jsonwebtoken 9.0.2 - https://github.com/auth0/node-jsonwebtoken
- Nodemailer 6.9.16 - https://nodemailer.com
- multer 1.4.5 - https://github.com/expressjs/multer
- nanoid 3.3.8 - https://github.com/ai/nanoid
- ics 3.8.1 - https://github.com/adamgibbons/ics

**Documentation References**:
- React Hooks: https://react.dev/reference/react/hooks
- Express Routing: https://expressjs.com/en/guide/routing.html
- Mongoose Schema: https://mongoosejs.com/docs/guide.html
- Tailwind Utilities: https://tailwindcss.com/docs/utility-first
- JWT Best Practices: https://datatracker.ietf.org/doc/html/rfc8725

---
