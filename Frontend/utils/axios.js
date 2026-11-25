import axios from "axios";

const baseURL = import.meta.env.VITE_SERVER_URL?.trim().replace(/\/+$/, "") || "";

const api = axios.create({
  baseURL,
  withCredentials: true,
});

export default api;
