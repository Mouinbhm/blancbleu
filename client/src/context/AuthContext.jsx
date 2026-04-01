import { createContext, useContext, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Au démarrage : vérifier si un token existe déjà
  useEffect(() => {
    const token = localStorage.getItem("token");
    const saved = localStorage.getItem("user");

    if (!token || !saved) {
      setLoading(false);
      return;
    }

    // Restaurer l'user depuis localStorage immédiatement
    try {
      setUser(JSON.parse(saved));
    } catch {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const { data } = await authService.login({ email, password });

    // 1. Sauvegarder dans localStorage
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    // 2. Mettre à jour le state React immédiatement
    setUser(data.user);

    // 3. Naviguer vers dashboard
    navigate("/dashboard");
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
