import { Navigate, useLocation } from "react-router-dom";

import { LoadingState } from "../components/LoadingState";
import type { UserRole } from "../types";
import { useAuth } from "./AuthContext";

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  return user ? <Navigate to={user.role === "Applicant" ? "/applications" : "/"} replace /> : children;
}

export function RoleRoute({
  roles,
  children,
}: {
  roles: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export const ApplicantRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute roles={["Applicant"]}>{children}</RoleRoute>
);
export const AdministratorRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute roles={["Administrator"]}>{children}</RoleRoute>
);
export const ExpertRoute = ({ children }: { children: React.ReactNode }) => (
  <RoleRoute roles={["Expert"]}>{children}</RoleRoute>
);
