import { useQuery } from '@tanstack/react-query';
import { authApi } from './auth.api';

export const authKeys = {
    currentUser: ['auth', 'current-user'] as const,
};

export function useCurrentUser() {
    return useQuery({
        queryKey: authKeys.currentUser,
        queryFn: authApi.getCurrentUser,
    });
}
