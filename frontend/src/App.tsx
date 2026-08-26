import { Route, Routes } from "react-router-dom";

import { AdministratorRoute, ApplicantRoute, AuthenticatedRoute, ExpertRoute, GuestRoute } from "./auth/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import { ApplicationCreatePage } from "./pages/ApplicationCreatePage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { GrantDetailPage } from "./pages/GrantDetailPage";
import { GrantsPage } from "./pages/GrantsPage";
import { HomePage } from "./pages/HomePage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { AdminApplicationsPage } from "./pages/admin/AdminApplicationsPage";
import { AdminDashboardPage } from "./pages/admin/AdminDashboardPage";
import { AdminGrantFormPage } from "./pages/admin/AdminGrantFormPage";
import { AdminGrantsPage } from "./pages/admin/AdminGrantsPage";
import { AdminUsersPage } from "./pages/admin/AdminUsersPage";
import { ExpertAssignmentDetailPage } from "./pages/expert/ExpertAssignmentDetailPage";
import { ExpertAssignmentsPage } from "./pages/expert/ExpertAssignmentsPage";
import { ExpertDashboardPage } from "./pages/expert/ExpertDashboardPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="grants" element={<GrantsPage />} />
        <Route path="grants/:id" element={<GrantDetailPage />} />
        <Route path="login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="password-reset" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
        <Route path="password-reset/confirm" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
        <Route path="profile" element={<AuthenticatedRoute><ProfilePage /></AuthenticatedRoute>} />
        <Route path="applications" element={<ApplicantRoute><ApplicationsPage /></ApplicantRoute>} />
        <Route path="applications/new" element={<ApplicantRoute><ApplicationCreatePage /></ApplicantRoute>} />
        <Route path="applications/:id" element={<ApplicantRoute><ApplicationDetailPage /></ApplicantRoute>} />
        <Route path="admin" element={<AdministratorRoute><AdminDashboardPage /></AdministratorRoute>} />
        <Route path="admin/grants" element={<AdministratorRoute><AdminGrantsPage /></AdministratorRoute>} />
        <Route path="admin/grants/new" element={<AdministratorRoute><AdminGrantFormPage /></AdministratorRoute>} />
        <Route path="admin/grants/:id/edit" element={<AdministratorRoute><AdminGrantFormPage /></AdministratorRoute>} />
        <Route path="admin/applications" element={<AdministratorRoute><AdminApplicationsPage /></AdministratorRoute>} />
        <Route path="admin/users" element={<AdministratorRoute><AdminUsersPage /></AdministratorRoute>} />
        <Route path="expert" element={<ExpertRoute><ExpertDashboardPage /></ExpertRoute>} />
        <Route path="expert/assignments" element={<ExpertRoute><ExpertAssignmentsPage /></ExpertRoute>} />
        <Route path="expert/assignments/:id" element={<ExpertRoute><ExpertAssignmentDetailPage /></ExpertRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
