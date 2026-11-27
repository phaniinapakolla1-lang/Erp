import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { LoginPage } from './pages/LoginPage';
import { FacultyAssignmentsPage, FacultyAttendancePage, FacultyClassesPage, FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { EvaluationWorkspace } from './pages/faculty/EvaluationWorkspace';
import { StudentAssignmentsPage, StudentAttendancePage, StudentDashboard, StudentMarksPage } from './pages/student/StudentPortal';
import { StudentDetailPage } from './pages/student/StudentDetailPage';
import { StudentSubjectsPage } from './pages/student/StudentSubjectsPage';
import { AdminAcademicSetupPage, AdminDashboard, AdminOversightBackupPage, AdminUsersPage } from './pages/admin/AdminPortal';
import { AdminReportsPage } from './pages/admin/AdminReportsPage';
import { AdminFeesPage } from './pages/admin/AdminFeesPage';
import { ExamControllerPortal } from './pages/exam/ExamControllerPortal';
import { StudentExamPage } from './pages/student/StudentExamPage';
import { HodDashboard, HodOversightPage } from './pages/hod/HodPortal';
import { CalendarPage, NotificationsPage, SettingsPage } from './pages/shared/CalendarAndSettings';
import { AnnouncementsPage, LearningResourcesPage } from './pages/shared/ResourcesAndAnnouncements';
import { SyllabusPage } from './pages/shared/SyllabusPage';
import { CollegeMailPage } from './pages/shared/CollegeMailPage';
import { UserRole } from './types/erp';

const RequireRole: React.FC<{ allowed: UserRole[]; children: React.ReactNode }> = ({ allowed, children }) => {
  const { profile } = useAuth();
  if (!profile || profile.status !== 'approved') return <Navigate to="/" replace />;
  if (!allowed.includes(profile.role)) return <Navigate to={`/${profile.role}`} replace />;
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { profile, loading, recovering } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading College ERP...</div>;
  if (recovering) return <ResetPasswordPage />;
  if (!profile || profile.status !== 'approved') return <LoginPage />;

  const homePath = `/${profile.role}`;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/admin" element={<RequireRole allowed={['admin']}><AdminDashboard /></RequireRole>} />
        <Route path="/admin/users" element={<RequireRole allowed={['admin']}><AdminUsersPage /></RequireRole>} />
        <Route path="/admin/academic" element={<RequireRole allowed={['admin']}><AdminAcademicSetupPage /></RequireRole>} />
        <Route path="/admin/oversight" element={<RequireRole allowed={['admin']}><AdminOversightBackupPage /></RequireRole>} />
        <Route path="/admin/reports" element={<RequireRole allowed={['admin']}><AdminReportsPage /></RequireRole>} />
        <Route path="/admin/fees" element={<RequireRole allowed={['admin']}><AdminFeesPage /></RequireRole>} />
        <Route path="/admin/exams" element={<RequireRole allowed={['admin']}><ExamControllerPortal /></RequireRole>} />
        <Route path="/exam_controller" element={<RequireRole allowed={['exam_controller', 'admin']}><ExamControllerPortal /></RequireRole>} />
        <Route path="/exam-controller" element={<RequireRole allowed={['exam_controller', 'admin']}><ExamControllerPortal /></RequireRole>} />

        <Route path="/faculty" element={<RequireRole allowed={['faculty']}><FacultyDashboard /></RequireRole>} />
        <Route path="/faculty/classes" element={<RequireRole allowed={['faculty']}><FacultyClassesPage /></RequireRole>} />
        <Route path="/faculty/attendance" element={<RequireRole allowed={['faculty']}><FacultyAttendancePage /></RequireRole>} />
        <Route path="/faculty/assignments" element={<RequireRole allowed={['faculty']}><FacultyAssignmentsPage /></RequireRole>} />
        <Route path="/faculty/evaluate" element={<RequireRole allowed={['faculty']}><EvaluationWorkspace /></RequireRole>} />

        <Route path="/student" element={<RequireRole allowed={['student']}><StudentDashboard /></RequireRole>} />
        <Route path="/student/subjects" element={<RequireRole allowed={['student']}><StudentSubjectsPage /></RequireRole>} />
        <Route path="/student/attendance" element={<RequireRole allowed={['student']}><StudentAttendancePage /></RequireRole>} />
        <Route path="/student/assignments" element={<RequireRole allowed={['student']}><StudentAssignmentsPage /></RequireRole>} />
        <Route path="/student/marks" element={<RequireRole allowed={['student']}><StudentMarksPage /></RequireRole>} />
        <Route path="/student/exams" element={<RequireRole allowed={['student']}><StudentExamPage /></RequireRole>} />

        <Route path="/students/:studentId" element={<RequireRole allowed={['admin', 'hod', 'faculty', 'student', 'exam_controller']}><StudentDetailPage /></RequireRole>} />

        <Route path="/hod" element={<RequireRole allowed={['hod']}><HodDashboard /></RequireRole>} />
        <Route path="/hod/oversight" element={<RequireRole allowed={['hod']}><HodOversightPage /></RequireRole>} />

        <Route path="/resources" element={<LearningResourcesPage />} />
        <Route path="/syllabus" element={<SyllabusPage />} />
        <Route path="/mail" element={<CollegeMailPage />} />
        <Route path="/announcements" element={<AnnouncementsPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to={homePath} replace />} />
      </Route>
    </Routes>
  );
};

export const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  </AuthProvider>
);
export default App;
