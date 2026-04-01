import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import PrivateRoute from "./components/PrivateRoute";
import Layout from "./components/layout/Layout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Interventions from "./pages/Interventions";
import Carte from "./pages/Carte";
import Flotte from "./pages/Flotte";
import AideIA from "./pages/AideIA";
import Rapports from "./pages/Rapports";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Publique ─────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />

          {/* ── Privées — toutes sous Layout (sidebar + topbar) ── */}
          <Route
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/interventions" element={<Interventions />} />
            <Route path="/carte" element={<Carte />} />
            <Route path="/flotte" element={<Flotte />} />
            <Route path="/aide-ia" element={<AideIA />} />
            <Route path="/rapports" element={<Rapports />} />
          </Route>

          {/* ── Redirections par défaut ──────────────────────── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
