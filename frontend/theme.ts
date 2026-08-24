'use client';

import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
    cssVariables: true,

    palette: {
        primary: {
            main: '#5b5bd6',
        },

        background: {
            default: '#f7f8fc',
            paper: '#ffffff',
        },

        text: {
            primary: '#17171f',
            secondary: '#626274',
        },
    },

    shape: {
        borderRadius: 12,
    },

    typography: {
        fontFamily: [
            'Inter',
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Arial',
            'sans-serif',
        ].join(','),

        button: {
            textTransform: 'none',
            fontWeight: 600,
        },
    },

    components: {
        MuiButton: {
            defaultProps: {
                disableElevation: true,
            },

            styleOverrides: {
                root: {
                    minHeight: 44,
                    borderRadius: 10,
                },
            },
        },

        MuiOutlinedInput: {
            styleOverrides: {
                root: {
                    borderRadius: 10,
                },
            },
        },
    },
});
