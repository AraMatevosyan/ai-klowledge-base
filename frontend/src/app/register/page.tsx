import { Box, Container, Paper, Stack, Typography } from '@mui/material';
import { RegisterForm } from '@/features/auth/components/register-form';

export default function RegisterPage() {
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
                            Create your account
                        </Typography>

                        <Typography color="text.secondary">
                            Start building your AI-powered document library.
                        </Typography>
                    </Stack>

                    <RegisterForm />
                </Paper>
            </Container>
        </Box>
    );
}
