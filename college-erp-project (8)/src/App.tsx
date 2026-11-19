import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { FacultyAssignmentsPage, FacultyAttendancePage, FacultyClassesPage, FacultyDashboard } from './pages/faculty/FacultyDashboard';
import { EvaluationWorkspace } from './pages/faculty/EvaluationWorkspace';
import { StudentAssignmentsPage, StudentAttendancePage, StudentDashboard, StudentMarksPage } from './pages/student/StudentPortal';
import { AdminAcademicSetupPage, AdminDashboard, AdminOversightBackupPage, AdminUsersPage } from './pages/admin/AdminPortal';
import { HodDashboard, HodOversightPage } from './pages/hod/HodPortal';
import { CalendarPage, NotificationsPage, SettingsPage } from './pages/shared/CalendarAndSettings';

const AppRoutes: React.FC = () => {
  const { profile, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading College ERP...</div>;
  if (!profile || profile.status !== 'approved') return <LoginPage />;

  const homePath = `/${profile.role}`;

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/users" element={<AdminUsersPage />} />
        <Route path="/admin/academic" element={<AdminAcademicSetupPage />} />
        <Route path="/admin/oversight" element={<AdminOversightBackupPage />} />

        <Route path="/faculty" element={<FacultyDashboard />} />
        <Route path="/faculty/classes" element={<FacultyClassesPage />} />
        <Route path="/faculty/attendance" element={<FacultyAttendancePage />} />
        <Route path="/faculty/assignments" element={<FacultyAssignmentsPage />} />
        <Route path="/faculty/evaluate" element={<EvaluationWorkspace />} />

        <Route path="/student" element={<StudentDashboard />} />
        <Route path="/student/attendance" element={<StudentAttendancePage />} />
        <Route path="/student/assignments" element={<StudentAssignmentsPage />} />
        <Route path="/student/marks" element={<StudentMarksPage />} />

        <Route path="/hod" element={<HodDashboard />} />
        <Route path="/hod/oversight" element={<HodOversightPage />} />

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
