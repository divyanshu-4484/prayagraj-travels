import axios from 'axios'

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_BASE_URL || ''}/api/travels`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.response.use(
  res => res,
  err => {
    const msg = err.response?.data?.error || err.message || 'Something went wrong'
    return Promise.reject(new Error(msg))
  }
)

export const busService = {
  getAll: () => api.get('/buses').then(r => r.data),
  getById: (id) => api.get(`/buses/${id}`).then(r => r.data),
  search: (source, destination) => api.get('/search', { params: { source, destination } }).then(r => r.data),
  getSeats: (busId, travelDate) => api.get('/seats', { params: { busId, travelDate } }).then(r => r.data),
  holdSeat: (data) => api.post('/seats/hold', data).then(r => r.data),
  releaseSeat: (data) => api.post('/seats/release', data).then(r => r.data),
  getLiveLocation: (busId) => api.get('/live-location', { params: { busId } }).then(r => r.data),
  getAllLiveLocations: () => api.get('/live-location/all').then(r => r.data),
}

export const bookingService = {
  book: (data) => api.post('/book', data).then(r => r.data),
  getByUser: (userId) => api.get('/bookings', { params: { userId } }).then(r => r.data),
  cancel: (bookingId, userId) => api.delete(`/bookings/${bookingId}`, { params: { userId } }).then(r => r.data),
}

export default api
