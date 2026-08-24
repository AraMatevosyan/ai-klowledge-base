'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Alert,
    Button,
    CircularProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { authApi } from '../auth.api';
import { authKeys } from '../auth.queries';
import { ApiError } from '@/lib/api';
import Link from 'next/link';

export function LoginForm() {
    const router = useRouter();
    const queryClient = useQueryClient();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const loginMutation = useMutation({
        mutationFn: authApi.login,

        onSuccess: (data) => {
            queryClient.setQueryData(authKeys.currentUser, data);

            router.replace('/dashboard');
        },
    });

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        loginMutation.mutate({
            email,
            password,
        });
    }

    const errorMessage =
        loginMutation.error instanceof ApiError
            ? loginMutation.error.message
            : loginMutation.isError
              ? 'Unable to connect to the server.'
              : null;

    return (
        <Stack
            component="form"
            spacing={2.5}
            onSubmit={handleSubmit}
            noValidate
        >
            {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

            <TextField
                label="Email address"
                type="email"
                value={email}
                autoComplete="email"
                required
                disabled={loginMutation.isPending}
                onChange={(event) => {
                    setEmail(event.target.value);
                }}
            />

            <TextField
                label="Password"
                type="password"
                value={password}
                autoComplete="current-password"
                required
                disabled={loginMutation.isPending}
                slotProps={{
                    htmlInput: {
                        minLength: 8,
                        maxLength: 72,
                    },
                }}
                onChange={(event) => {
                    setPassword(event.target.value);
                }}
            />

            <Button
                type="submit"
                variant="contained"
                size="large"
                disabled={
                    !email || password.length < 8 || loginMutation.isPending
                }
                startIcon={
                    loginMutation.isPending ? (
                        <CircularProgress size={18} color="inherit" />
                    ) : undefined
                }
            >
                {loginMutation.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                Don&apos;t have an account?{' '}
                <Link
                    href="/register"
                    style={{
                        color: '#5b5bd6',
                        fontWeight: 600,
                    }}
                >
                    Create one
                </Link>
            </Typography>
        </Stack>
    );
}
