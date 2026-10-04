import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./shared/context/AuthContext";
import { RequireRole } from "./shared/components/RequireRole";
import { AppLayout } from "./shared/components/Layout/AppLayout";
import { AuthPage } from "./shared/pages/AuthPage";
import { PlaceholderPage } from "./shared/components/PlaceholderPage";
import { ReservationsPage } from "./reservations";
import { FleetPage } from "./fleet";

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public authentication route */}
          <Route path="/login" element={<AuthPage />} />

          {/* Protected Navigation Shell */}
          <Route
            element={
              <RequireRole>
                <AppLayout />
              </RequireRole>
            }
          >
            {/* 1. Operator Dashboard */}
            <Route
              path="/"
              element={
                <PlaceholderPage
                  title="Operator Dashboard"
                  description="Overview of current operator identity, operational credentials, and active airspace alerts."
                  owner="Identity & Profile Module"
                  endpoints={["GET /api/operators/me"]}
                />
              }
            />

            {/* 2. Fleet Management (Fleet Operator only) */}
            <Route
              path="/fleet"
              element={
                <RequireRole roles={["FLEET_OPERATOR"]}>
                  <FleetPage />
                </RequireRole>
              }
            />

            {/* 3. Regulator Console (Regulator only) */}
            <Route
              path="/regulator"
              element={
                <RequireRole roles={["REGULATOR"]}>
                  <PlaceholderPage
                    title="Regulator Airspace Console"
                    description="Civil aviation authority oversight, operator license suspension, and immutable security audit trails."
                    owner="Regulator Oversight Module"
                    endpoints={[
                      "GET /api/operators",
                      "PATCH /api/operators/:id/suspend",
                      "GET /api/audit-log",
                    ]}
                  />
                </RequireRole>
              }
            />

            {/* 4. Booking / Airspace Reservation (Shravan's page) */}
            <Route
              path="/reservations"
              element={
                <RequireRole roles={["FLEET_OPERATOR", "DISPATCHER"]}>
                  <ReservationsPage />
                </RequireRole>
              }
            />

            {/* 5. Live Telemetry Map (Shlok's page) */}
            <Route
              path="/telemetry"
              element={
                <RequireRole>
                  <PlaceholderPage
                    title="Live Telemetry & Radar Map"
                    description="Real-time drone GPS streaming, geofencing violations, and altitude monitoring."
                    owner="Shlok"
                    isComingSoon
                  />
                </RequireRole>
              }
            />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
