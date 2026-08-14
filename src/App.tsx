import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Login from './pages/Login'
import SignUp from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import CompleteProfile from './pages/CompleteProfile'
import RequireRole from './components/RequireRole'
import Help from './pages/Help'
import TeacherDashboard from './pages/TeacherDashboard'
import StudentDashboard from './pages/StudentDashboard'
import GuestDashboard from './pages/GuestDashboard'
import LessonPage from './pages/LessonPage'
import Leaderboards from './pages/Leaderboards'
import WordMatchingActivity from './pages/WordMatchingActivity'
import QuickRecallActivity from './pages/QuickRecallActivity'
import StorytellingActivity from './pages/StorytellingActivity'
import DiscussionHubActivity from './pages/DiscussionHubActivity'
import OpinionSharingActivity from './pages/OpinionSharingActivity'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/help" element={<Help />} />
      <Route path="/teacher" element={<RequireRole role="teacher"><TeacherDashboard /></RequireRole>} />
      <Route path="/student" element={<RequireRole role="student"><StudentDashboard /></RequireRole>} />
      <Route path="/guest" element={<GuestDashboard />} />
      <Route path="/lesson/:lessonId" element={<LessonPage />} />
      <Route path="/leaderboards" element={<Leaderboards />} />
      <Route path="/lesson/:lessonId/word-matching" element={<WordMatchingActivity />} />
      <Route path="/lesson/:lessonId/quick-recall" element={<QuickRecallActivity />} />
      <Route path="/lesson/:lessonId/storytelling/:setId" element={<StorytellingActivity />} />
      <Route path="/lesson/:lessonId/discussion/:promptId" element={<DiscussionHubActivity />} />
      <Route path="/lesson/:lessonId/opinion/:promptId" element={<OpinionSharingActivity />} />
    </Routes>
    )
}

export default App
