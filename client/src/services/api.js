import axios from "axios";

const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api",
  headers: { "Content-Type": "application/json" },
});

// Intercepteur token
API.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interventions
export const getInterventions = (params) =>
  API.get("/interventions", { params });
export const createIntervention = (data) => API.post("/interventions", data);
export const updateInterventionStatus = (id, status) =>
  API.patch(`/interventions/${id}/status`, { status });

// Unités
export const getUnits = (params) => API.get("/units", { params });
export const updateUnitStatus = (id, status) =>
  API.patch(`/units/${id}/status`, { status });

// IA
export const analyzeIncident = (data) => API.post("/ai/analyze", data);

export default API;
