const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${BASE}${url}`, {
    ...options,
    headers: { ...headers, ...options.headers },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string, nickname?: string) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, nickname }),
    }),

  getMe: () => request<{ user: any }>('/auth/me'),

  // Pets - public listing
  getPets: (params?: { species?: string; search?: string; page?: number; pageSize?: number }) => {
    const qs = new URLSearchParams();
    if (params?.species) qs.set('species', params.species);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    return request<{ pets: any[]; total: number }>(`/pets/list?${qs.toString()}`);
  },

  // Pets - protected
  getMyPets: () => request<{ pets: any[] }>('/pets/user/mine'),
  getPet: (id: number) => request<{ pet: any }>(`/pets/${id}`),
  createPet: (data: any) => request<{ pet: any }>('/pets', { method: 'POST', body: JSON.stringify(data) }),
  updatePet: (id: number, data: any) => request<{ pet: any }>(`/pets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePet: (id: number) => request<{ message: string }>(`/pets/${id}`, { method: 'DELETE' }),

  // Fostering
  getFosteringNeeds: (params?: { status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    return request<{ needs: any[]; total: number }>(`/fostering?${qs.toString()}`);
  },

  getPublicFosteringNeeds: () => request<{ needs: any[] }>('/fostering/list'),

  getMyFosteringNeeds: () => request<{ needs: any[] }>('/fostering/mine'),
  createFosteringNeed: (data: any) => request<{ need: any }>('/fostering', { method: 'POST', body: JSON.stringify(data) }),
  applyFostering: (id: number, data: any) => request<{ application: any }>(`/fostering/${id}/apply`, { method: 'POST', body: JSON.stringify(data) }),
  getApplications: (id: number) => request<{ applications: any[]; need: any }>(`/fostering/${id}/applications`),
  acceptApplication: (id: number) => request<{ message: string }>(`/fostering/applications/${id}/accept`, { method: 'POST' }),
  getMyApplications: () => request<{ applications: any[] }>('/fostering/my-applications'),
  completeFostering: (id: number) => request<{ message: string }>(`/fostering/${id}/complete`, { method: 'POST' }),
  submitReview: (id: number, data: any) => request<{ message: string }>(`/fostering/${id}/review`, { method: 'POST', body: JSON.stringify(data) }),
  getUserReviews: (userId: number) => request<{ reviews: any[] }>(`/fostering/user/${userId}/reviews`),

  // Messages
  getConversations: () => request<{ conversations: any[] }>('/messages/conversations'),
  getMessages: (fosteringNeedId: number) => request<{ messages: any[] }>(`/messages/${fosteringNeedId}`),
  sendMessage: (data: { to_user_id: number; fostering_need_id: number; content: string }) =>
    request<{ message: any }>('/messages', { method: 'POST', body: JSON.stringify(data) }),

  // Lost Found
  getLostPets: (params?: { found?: number }) => {
    const qs = new URLSearchParams();
    if (params?.found !== undefined) qs.set('found', String(params.found));
    return request<{ lostPets: any[]; total: number }>(`/lost-found?${qs.toString()}`);
  },
  getActiveLostPets: () => request<{ lostPets: any[] }>('/lost-found/active'),
  getMyLostPets: () => request<{ lostPets: any[] }>('/lost-found/mine'),
  createLostPet: (data: any) => request<{ lostPet: any }>('/lost-found', { method: 'POST', body: JSON.stringify(data) }),
  markFound: (id: number) => request<{ message: string }>(`/lost-found/${id}/found`, { method: 'PUT' }),
  deleteLostPet: (id: number) => request<{ message: string }>(`/lost-found/${id}`, { method: 'DELETE' }),

  // Profile
  getProfile: () => request<{ user: any }>('/profile'),
  updateProfile: (data: any) => request<{ user: any }>('/profile', { method: 'PUT', body: JSON.stringify(data) }),
};
