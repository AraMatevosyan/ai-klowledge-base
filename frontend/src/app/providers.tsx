'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v16-appRouter';
import { theme } from '../../theme';

type ProvidersProps = {
    children: ReactNode;
};

export function Providers({ children }: ProvidersProps) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        staleTime: 30_000,
                        retry: false,
                        refetchOnWindowFocus: false,
                    },

                    mutations: {
                        retry: false,
                    },
                },
            }),
    );

    return (
        <AppRouterCacheProvider>
            <QueryClientProvider client={queryClient}>
                <ThemeProvider theme={theme}>
                    <CssBaseline />

                    {children}
                </ThemeProvider>
            </QueryClientProvider>
        </AppRouterCacheProvider>
    );
}
