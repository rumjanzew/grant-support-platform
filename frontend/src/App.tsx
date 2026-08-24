import { Route, Routes } from "react-router-dom";

import { ApplicantRoute, GuestRoute } from "./auth/RouteGuards";
import { AppLayout } from "./components/AppLayout";
import { ApplicationCreatePage } from "./pages/ApplicationCreatePage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { GrantDetailPage } from "./pages/GrantDetailPage";
import { GrantsPage } from "./pages/GrantsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="grants" element={<GrantsPage />} />
        <Route path="grants/:id" element={<GrantDetailPage />} />
        <Route path="login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
        <Route path="applications" element={<ApplicantRoute><ApplicationsPage /></ApplicantRoute>} />
        <Route path="applications/new" element={<ApplicantRoute><ApplicationCreatePage /></ApplicantRoute>} />
        <Route path="applications/:id" element={<ApplicantRoute><ApplicationDetailPage /></ApplicantRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
