import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message ||
      'An unexpected error occurred';
    return Promise.reject(new Error(Array.isArray(message) ? message.join(', ') : message));
  },
);

export const alignService = {
  /** GET /architecture-map-align?projectId=1 */
  findByProject: (projectId) => api.get(`/architecture-map-align?projectId=${projectId}`).then((r) => r.data),

  /** POST /architecture-map-align */
  create: (body) => api.post('/architecture-map-align', body).then((r) => r.data),

  /** PATCH /architecture-map-align/:id */
  update: (id, body) => api.patch(`/architecture-map-align/${id}`, body).then((r) => r.data),

  /** DELETE /architecture-map-align/:id */
  remove: (id) => api.delete(`/architecture-map-align/${id}`).then((r) => r.data),
};
