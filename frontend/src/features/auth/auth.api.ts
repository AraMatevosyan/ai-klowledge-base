import { apiRequest } from '@/lib/api';
import { AuthCredentials, AuthResponse } from './auth.types';

export const authApi = {
    login: (credentials: AuthCredentials) => {
        return apiRequest<AuthResponse>('/auth/login', {
            method: 'POST',

            body: JSON.stringify(credentials),
        });
    },

    register: (credentials: AuthCredentials) => {
        return apiRequest<AuthResponse>('/auth/register', {
            method: 'POST',

            body: JSON.stringify(credentials),
        });
    },

    getCurrentUser: () => {
        return apiRequest<AuthResponse>('/auth/me');
    },

    logout: () => {
        return apiRequest<{
            success: boolean;
        }>('/auth/logout', {
            method: 'POST',
        });
    },
};
