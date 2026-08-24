import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { LoginForm } from '@/features/auth/components/login-form';

export default function LoginPage() {
    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'grid',
                placeItems: 'center',
                px: 2,
                py: 5,
                background:
                    'linear-gradient(145deg, #f1f1ff 0%, #f7f8fc 50%, #eefaf8 100%)',
            }}
        >
            <Container maxWidth="sm">
                <Paper
                    variant="outlined"
                    sx={{
                        p: {
                            xs: 3,
                            sm: 5,
                        },

                        borderRadius: 3,

                        boxShadow: '0 20px 60px rgba(31, 31, 64, 0.08)',
                    }}
                >
                    <Stack spacing={1} sx={{ mb: 4 }}>
                        <Typography
                            variant="h4"
                            component="h1"
                            sx={{ fontWeight: 700 }}
                        >
                            Welcome back
                        </Typography>

                        <Typography color="text.secondary">
                            Sign in to continue to your knowledge base.
                        </Typography>
                    </Stack>

                    <LoginForm />
                </Paper>
            </Container>
        </Box>
    );
}
