import axios from "axios";

const API_BASE_URL = "/api";

export const api = axios.create({
  baseURL: API_BASE_URL
});
function appendFilter(params, key, value) {
  if (Array.isArray(value) && value.length > 0) {
    params.append(key, value.join(","));
    return;
  }
  if (value !== undefined && value !== null && value !== "") {
    params.append(key, value);
  }
}

export async function fetchDashboard(filters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => appendFilter(params, key, value));
  const { data } = await api.get(`/dashboard?${params.toString()}`);
  return data;
}

export async function fetchFilters() {
  const { data } = await api.get("/dashboard/filters");
  return data;
}

export async function uploadCsv(file) {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data"
    }
  });
  return data;
}
