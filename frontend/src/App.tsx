import { Route, Routes } from "react-router-dom";

import { AdministratorRoute, ApplicantRoute, AuthenticatedRoute, ExpertRoute, GuestRoute } from "./auth/RouteGuards";
import { AdminLayout } from "./components/AdminLayout";
import { AppLayout } from "./components/AppLayout";
import { ScrollToTopButton } from "./components/ScrollToTopButton";
import { YandexMetrikaTracker } from "./components/YandexMetrikaTracker";
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
import { NotificationsPage } from "./pages/NotificationsPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { EmailVerificationPage } from "./pages/EmailVerificationPage";
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
    <>
      <YandexMetrikaTracker />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<HomePage />} />
          <Route path="grants" element={<GrantsPage />} />
          <Route path="grants/:id" element={<GrantDetailPage />} />
          <Route path="login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
          <Route path="password-reset" element={<GuestRoute><ForgotPasswordPage /></GuestRoute>} />
          <Route path="password-reset/confirm" element={<GuestRoute><ResetPasswordPage /></GuestRoute>} />
          <Route path="email-verification" element={<EmailVerificationPage />} />
          <Route path="profile" element={<AuthenticatedRoute><ProfilePage /></AuthenticatedRoute>} />
          <Route path="notifications" element={<AuthenticatedRoute><NotificationsPage /></AuthenticatedRoute>} />
          <Route path="applications" element={<ApplicantRoute><ApplicationsPage /></ApplicantRoute>} />
          <Route path="applications/new" element={<ApplicantRoute><ApplicationCreatePage /></ApplicantRoute>} />
          <Route path="applications/:id" element={<ApplicantRoute><ApplicationDetailPage /></ApplicantRoute>} />
          <Route path="expert" element={<ExpertRoute><ExpertDashboardPage /></ExpertRoute>} />
          <Route path="expert/assignments" element={<ExpertRoute><ExpertAssignmentsPage /></ExpertRoute>} />
          <Route path="expert/assignments/:id" element={<ExpertRoute><ExpertAssignmentDetailPage /></ExpertRoute>} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
        <Route path="admin" element={<AdministratorRoute><AdminLayout /></AdministratorRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="grants" element={<AdminGrantsPage />} />
          <Route path="grants/new" element={<AdminGrantFormPage />} />
          <Route path="grants/:id/edit" element={<AdminGrantFormPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <ScrollToTopButton />
    </>
  );
}
