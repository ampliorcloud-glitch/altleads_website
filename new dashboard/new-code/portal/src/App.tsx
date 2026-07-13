import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import PortalLayout from './components/PortalLayout'
import Login from './pages/Login'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import Meetings from './pages/Meetings'
import MeetingDetail from './pages/MeetingDetail'
import Notifications from './pages/Notifications'
import Profile from './pages/Profile'
import Feedback from './pages/Feedback'
import Wishlist from './pages/Wishlist'
import Governance from './pages/Governance'
import Documents from './pages/Documents'
import Invoices from './pages/Invoices'
import Updates from './pages/Updates'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* All portal routes require auth + portal access */}
        <Route element={<ProtectedRoute />}>
          <Route element={<PortalLayout />}>
            <Route index element={<Home />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="meetings" element={<Meetings />} />
            <Route path="meetings/:meetingId" element={<MeetingDetail />} />
            <Route path="meetings/:meetingId/feedback" element={<Feedback />} />
            <Route path="governance" element={<Governance />} />
            <Route path="documents" element={<Documents />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="updates" element={<Updates />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="profile" element={<Profile />} />
            <Route path="wishlist" element={<Wishlist />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
