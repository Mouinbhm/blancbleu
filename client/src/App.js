import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Interventions from "./pages/Interventions";
import Carte from "./pages/Carte";
import Flotte from "./pages/Flotte";
import AideIA from "./pages/AideIA";
import Rapports from "./pages/Rapports";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="interventions" element={<Interventions />} />
          <Route path="carte" element={<Carte />} />
          <Route path="flotte" element={<Flotte />} />
          <Route path="ia" element={<AideIA />} />
          <Route path="rapports" element={<Rapports />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
