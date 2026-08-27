'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import {
    Alert,
    AppBar,
    Avatar,
    Box,
    Button,
    CircularProgress,
    Container,
    IconButton,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import { ApiError } from '@/lib/api';
import { authApi } from '@/features/auth/auth.api';
import { authKeys, useCurrentUser } from '@/features/auth/auth.queries';
import { DocumentUpload } from '@/features/documents/components/DocumentUpload';
import { DocumentsList } from '@/features/documents/components/DocumentsList';
import { ChatPanel } from '@/features/chat/components/ChatPanel';
import { useAppOperationState } from '@/lib/app-operation';
import { AboutAppDialog } from '@/components/AboutAppDialog';

export default function DashboardPage() {
    const router = useRouter();

    const queryClient = useQueryClient();

    const currentUserQuery = useCurrentUser();

    const { isBusy } = useAppOperationState();

    const logoutMutation = useMutation({
        mutationFn: authApi.logout,

        onSuccess: () => {
            queryClient.removeQueries({
                queryKey: authKeys.currentUser,
            });

            router.replace('/login');
        },
    });

    useEffect(() => {
        const error = currentUserQuery.error;

        if (error instanceof ApiError && error.status === 401) {
            router.replace('/login');
        }
    }, [currentUserQuery.error, router]);

    if (currentUserQuery.isPending) {
        return <FullPageLoader />;
    }

    if (currentUserQuery.isError) {
        const error = currentUserQuery.error;

        if (error instanceof ApiError && error.status === 401) {
            return <FullPageLoader />;
        }

        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    px: 2,
                }}
            >
                <Alert
                    severity="error"
                    action={
                        <Button onClick={() => currentUserQuery.refetch()}>
                            Retry
                        </Button>
                    }
                >
                    Unable to load your account. Make sure the backend is
                    running.
                </Alert>
            </Box>
        );
    }

    const user = currentUserQuery.data.user;

    const handleLogout = () => {
        logoutMutation.mutate();
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: 'background.default',
            }}
        >
            <AppBar
                position="sticky"
                color="inherit"
                elevation={0}
                sx={{
                    bgcolor: 'background.paper',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                }}
            >
                <Container
                    maxWidth="lg"
                    sx={{
                        px: {
                            xs: 2,
                            sm: 3,
                        },
                    }}
                >
                    <Toolbar
                        disableGutters
                        sx={{
                            minHeight: {
                                xs: 60,
                                sm: 72,
                            },
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{
                                color: 'primary.main',
                                fontWeight: 700,
                                whiteSpace: 'nowrap',
                            }}
                        >
                            <Box
                                component="span"
                                sx={{
                                    display: {
                                        xs: 'none',
                                        sm: 'inline',
                                    },
                                }}
                            >
                                AI Knowledge Base
                            </Box>

                            <Box
                                component="span"
                                sx={{
                                    display: {
                                        xs: 'inline',
                                        sm: 'none',
                                    },
                                }}
                            >
                                AI KB
                            </Box>
                        </Typography>

                        <Box
                            sx={{
                                flexGrow: 1,
                            }}
                        />

                        <Stack
                            direction="row"
                            spacing={{
                                xs: 0.5,
                                sm: 1.5,
                            }}
                            sx={{
                                alignItems: 'center',
                            }}
                        >
                            <Avatar
                                sx={{
                                    display: {
                                        xs: 'none',
                                        sm: 'grid',
                                    },
                                    width: 34,
                                    height: 34,
                                    bgcolor: 'primary.main',
                                    fontSize: 14,
                                    fontWeight: 700,
                                }}
                            >
                                {user.email.charAt(0).toUpperCase()}
                            </Avatar>

                            <Typography
                                title={user.email}
                                sx={{
                                    display: {
                                        xs: 'none',
                                        md: 'block',
                                    },
                                    maxWidth: 220,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontSize: 14,
                                    fontWeight: 600,
                                }}
                            >
                                {user.email}
                            </Typography>

                            <AboutAppDialog />

                            <Tooltip title="Logout">
                                <span>
                                    <IconButton
                                        aria-label="Logout"
                                        color="inherit"
                                        disabled={
                                            logoutMutation.isPending || isBusy
                                        }
                                        onClick={handleLogout}
                                        sx={{
                                            display: {
                                                xs: 'inline-flex',
                                                sm: 'none',
                                            },
                                        }}
                                    >
                                        {logoutMutation.isPending ? (
                                            <CircularProgress
                                                size={20}
                                                color="inherit"
                                            />
                                        ) : (
                                            <LogoutRoundedIcon />
                                        )}
                                    </IconButton>
                                </span>
                            </Tooltip>

                            <Button
                                color="inherit"
                                startIcon={
                                    logoutMutation.isPending ? (
                                        <CircularProgress
                                            size={18}
                                            color="inherit"
                                        />
                                    ) : (
                                        <LogoutRoundedIcon />
                                    )
                                }
                                disabled={logoutMutation.isPending || isBusy}
                                onClick={handleLogout}
                                sx={{
                                    display: {
                                        xs: 'none',
                                        sm: 'inline-flex',
                                    },
                                }}
                            >
                                Logout
                            </Button>
                        </Stack>
                    </Toolbar>
                </Container>
            </AppBar>

            <Container
                maxWidth="lg"
                sx={{
                    width: '100%',
                    px: {
                        xs: 2,
                        sm: 3,
                    },
                    py: {
                        xs: 3,
                        sm: 5,
                        md: 8,
                    },
                }}
            >
                {logoutMutation.isError && (
                    <Alert
                        severity="error"
                        sx={{
                            mb: {
                                xs: 2,
                                sm: 3,
                            },
                        }}
                    >
                        Unable to log out. Please try again.
                    </Alert>
                )}

                <Stack
                    spacing={{
                        xs: 2,
                        sm: 3,
                    }}
                >
                    <DocumentUpload />

                    <DocumentsList />

                    <ChatPanel />
                </Stack>
            </Container>
        </Box>
    );
}

function FullPageLoader() {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
            }}
        >
            <CircularProgress size={30} />
        </Box>
    );
}
