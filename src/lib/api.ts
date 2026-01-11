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

  // Diary
  getDiaryEntries: () => apiRequest<any[]>('/diary'),
};
