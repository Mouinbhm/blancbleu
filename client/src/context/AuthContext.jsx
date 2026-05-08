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

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    setUser(data.user);

    if (data.user?.mustChangePassword) {
      navigate("/force-change-password");
    } else {
      navigate("/dashboard");
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    navigate("/login");
  };

  const clearMustChangePassword = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, mustChangePassword: false };
      localStorage.setItem("user", JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, clearMustChangePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
