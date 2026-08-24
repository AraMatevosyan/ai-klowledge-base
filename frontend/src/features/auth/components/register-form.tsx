'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import {
    Alert,
    Button,
    CircularProgress,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { authApi } from '../auth.api';
import { ApiError } from '@/lib/api';

export function RegisterForm() {
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const registerMutation = useMutation({
        mutationFn: authApi.register,

        onSuccess: () => {
            router.replace('/login');
        },
    });

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        registerMutation.mutate({
            email,
            password,
        });
    }

    const errorMessage =
        registerMutation.error instanceof ApiError
            ? registerMutation.error.message
            : registerMutation.isError
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
                autoComplete="email"
                value={email}
                required
                disabled={registerMutation.isPending}
                onChange={(event) => {
                    setEmail(event.target.value);
                }}
            />

            <TextField
                label="Password"
                type="password"
                autoComplete="new-password"
                value={password}
                required
                helperText="Use at least 8 characters."
                disabled={registerMutation.isPending}
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
                    !email || password.length < 8 || registerMutation.isPending
                }
                startIcon={
                    registerMutation.isPending ? (
                        <CircularProgress size={18} color="inherit" />
                    ) : undefined
                }
            >
                {registerMutation.isPending
                    ? 'Creating account...'
                    : 'Create account'}
            </Button>

            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                Already have an account?{' '}
                <Link
                    href="/login"
                    style={{
                        color: '#5b5bd6',
                        fontWeight: 600,
                    }}
                >
                    Sign in
                </Link>
            </Typography>
        </Stack>
    );
}
