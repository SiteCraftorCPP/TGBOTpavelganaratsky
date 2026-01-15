// API client for admin panel (replacing Supabase)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://liftme.by/api';

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Clients
  getClients: () => apiRequest<any[]>('/clients'),
  updateClient: (id: string, data: { first_name: string | null; last_name: string | null }) =>
    apiRequest<void>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteClient: (id: string) => apiRequest<void>(`/clients/${id}`, { method: 'DELETE' }),

  // Slots
  getSlots: () => apiRequest<any[]>('/slots'),
  createSlot: (data: { date: string; time: string; available_formats: string }) =>
    apiRequest<any>('/slots', { method: 'POST', body: JSON.stringify(data) }),
  deleteSlot: (id: string) => apiRequest<void>(`/slots/${id}`, { method: 'DELETE' }),

  // SOS
  getSosRequests: () => apiRequest<any[]>('/sos'),
  markSosAsViewed: (id: string) =>
    apiRequest<void>(`/sos/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'viewed' }) }),

  // Payments
  getPayments: () => apiRequest<any[]>('/payments'),
  deletePayment: (id: string) => apiRequest<void>(`/payments/${id}`, { method: 'DELETE' }),

  // Payment card
  getPaymentCard: () => apiRequest<{ card_number: string }>('/payment-card'),
  savePaymentCard: (cardNumber: string) =>
    apiRequest<void>('/payment-card', { method: 'PUT', body: JSON.stringify({ card_number: cardNumber }) }),

  // Payment settings (all settings)
  getPaymentSettings: () => apiRequest<{ payment_link: string; erip_path: string; account_number: string; card_number: string }>('/payment-settings'),
  savePaymentSettings: (settings: { payment_link?: string; erip_path?: string; account_number?: string; card_number?: string }) =>
    apiRequest<void>('/payment-settings', { method: 'PUT', body: JSON.stringify(settings) }),

  // Diary
  getDiaryEntries: () => apiRequest<any[]>('/diary'),

  // Schedule template
  getScheduleTemplate: () => apiRequest<{ days: Array<{ day: string; times: Array<{ time: string; available_formats: string }> }> }>('/schedule-template'),
  saveScheduleTemplate: () => apiRequest<{ success: boolean; template: any }>('/schedule-template', { method: 'POST' }),
  deleteScheduleTemplate: () => apiRequest<void>('/schedule-template', { method: 'DELETE' }),
  applyScheduleTemplate: (weeks: number) => apiRequest<{ success: boolean; created: number }>('/schedule-template/apply', { method: 'POST', body: JSON.stringify({ weeks }) }),

  // Booking
  cancelBooking: (slotId: string) => {
    const baseUrl = API_BASE_URL.replace('/api', '');
    return fetch(`${baseUrl}/cancel-booking-admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slotId })
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    });
  },
  bookForClient: (data: { clientId: string; date: string; time: string; format: string }) => {
    const baseUrl = API_BASE_URL.replace('/api', '');
    return fetch(`${baseUrl}/book-for-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    });
  },

  // Regular bookings
  createRegularBookings: (data: { clientId: string; date: string; time: string; weeks: number; format: string }) => {
    const baseUrl = API_BASE_URL.replace('/api', '');
    return fetch(`${baseUrl}/create-regular-bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    }).then(async (res) => {
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP error! status: ${res.status}`);
      }
      return res.json();
    });
  },
};
