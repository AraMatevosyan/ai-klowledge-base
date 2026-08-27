'use client';

import { useState } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
    useMediaQuery,
    useTheme,
} from '@mui/material';

const usageSteps = [
    {
        title: 'Upload PDF documents',
        description: 'Upload one or more PDF files containing selectable text.',
    },
    {
        title: 'Wait for processing',
        description:
            'The document becomes searchable when its status changes to Ready.',
    },
    {
        title: 'Ask a question',
        description:
            'The AI searches across all your ready documents and selects relevant sections.',
    },
    {
        title: 'Review the sources',
        description:
            'Answers include numbered sources with document names, page numbers and excerpts.',
    },
];

const exampleQuestions = [
    'Summarize all uploaded documents.',
    'What are the main topics across my documents?',
    'Compare the information in the uploaded documents.',
    'Which technologies are mentioned in the resume?',
    'What is the total amount shown in the invoice?',
    'Does any document mention a termination policy?',
];

export function AboutAppDialog() {
    const [open, setOpen] = useState(false);

    const [copiedQuestion, setCopiedQuestion] = useState<string | null>(null);

    const theme = useTheme();

    const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

    const handleCopy = async (question: string) => {
        try {
            await navigator.clipboard.writeText(question);

            setCopiedQuestion(question);
        } catch {
            setCopiedQuestion(null);
        }
    };

    return (
        <>
            <Tooltip title="How it works">
                <IconButton
                    aria-label="How it works"
                    color="inherit"
                    onClick={() => setOpen(true)}
                    sx={{
                        display: {
                            xs: 'inline-flex',
                            sm: 'none',
                        },
                    }}
                >
                    <InfoOutlinedIcon />
                </IconButton>
            </Tooltip>

            <Button
                color="inherit"
                size="small"
                startIcon={<InfoOutlinedIcon />}
                onClick={() => setOpen(true)}
                sx={{
                    display: {
                        xs: 'none',
                        sm: 'inline-flex',
                    },
                    whiteSpace: 'nowrap',
                }}
            >
                How it works
            </Button>

            <Dialog
                open={open}
                onClose={() => setOpen(false)}
                fullScreen={fullScreen}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle
                    component="div"
                    sx={{
                        p: {
                            xs: 2,
                            sm: 3,
                        },
                    }}
                >
                    <Stack
                        direction="row"
                        spacing={2}
                        sx={{
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                        }}
                    >
                        <Box>
                            <Typography variant="h5">
                                About AI Knowledge Base
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mt: 0.5 }}
                            >
                                Ask grounded questions across your uploaded PDF
                                documents.
                            </Typography>
                        </Box>

                        <IconButton
                            aria-label="Close"
                            onClick={() => setOpen(false)}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    </Stack>
                </DialogTitle>

                <DialogContent
                    dividers
                    sx={{
                        p: {
                            xs: 2,
                            sm: 3,
                        },
                    }}
                >
                    <Stack spacing={3}>
                        <Box>
                            <Typography variant="h6" gutterBottom>
                                What is this application?
                            </Typography>

                            <Typography variant="body2" color="text.secondary">
                                AI Knowledge Base is a document-based AI
                                assistant. It extracts text from your PDF files,
                                creates embeddings and uses semantic search to
                                find relevant information before generating an
                                answer.
                            </Typography>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="h6" gutterBottom>
                                How to use it
                            </Typography>

                            <Stack spacing={2}>
                                {usageSteps.map((step, index) => (
                                    <Stack
                                        key={step.title}
                                        direction="row"
                                        spacing={1.5}
                                    >
                                        <Box
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                display: 'grid',
                                                placeItems: 'center',
                                                flexShrink: 0,
                                                borderRadius: '50%',
                                                bgcolor: 'primary.main',
                                                color: 'primary.contrastText',
                                                fontSize: 13,
                                                fontWeight: 700,
                                            }}
                                        >
                                            {index + 1}
                                        </Box>

                                        <Box>
                                            <Typography
                                                variant="body2"
                                                sx={{ fontWeight: 600 }}
                                            >
                                                {step.title}
                                            </Typography>

                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {step.description}
                                            </Typography>
                                        </Box>
                                    </Stack>
                                ))}
                            </Stack>
                        </Box>

                        <Divider />

                        <Box>
                            <Typography variant="h6" gutterBottom>
                                Example questions
                            </Typography>

                            <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{ mb: 1.5 }}
                            >
                                Copy one of these questions and paste it into
                                the chat.
                            </Typography>

                            <Stack spacing={1}>
                                {exampleQuestions.map((question) => {
                                    const isCopied =
                                        copiedQuestion === question;

                                    return (
                                        <Paper
                                            key={question}
                                            variant="outlined"
                                            sx={{
                                                p: 1.25,
                                            }}
                                        >
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    justifyContent:
                                                        'space-between',
                                                }}
                                            >
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        overflowWrap:
                                                            'anywhere',
                                                    }}
                                                >
                                                    {question}
                                                </Typography>

                                                <Tooltip
                                                    title={
                                                        isCopied
                                                            ? 'Copied'
                                                            : 'Copy question'
                                                    }
                                                >
                                                    <IconButton
                                                        size="small"
                                                        aria-label="Copy question"
                                                        onClick={() =>
                                                            handleCopy(question)
                                                        }
                                                    >
                                                        {isCopied ? (
                                                            <CheckRoundedIcon
                                                                color="success"
                                                                fontSize="small"
                                                            />
                                                        ) : (
                                                            <ContentCopyRoundedIcon fontSize="small" />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </Paper>
                                    );
                                })}
                            </Stack>
                        </Box>

                        <Alert severity="info">
                            The assistant searches across all uploaded documents
                            with the Ready status. Use document names in your
                            question when you want to focus on a particular
                            file.
                        </Alert>

                        <Alert severity="warning">
                            Upload PDFs containing selectable text. Scanned
                            image-only PDFs require OCR and are not supported.
                            Do not upload confidential documents to this
                            portfolio demo.
                        </Alert>
                    </Stack>
                </DialogContent>

                <DialogActions
                    sx={{
                        p: {
                            xs: 2,
                            sm: 3,
                        },
                    }}
                >
                    <Button
                        variant="contained"
                        onClick={() => setOpen(false)}
                        sx={{
                            width: {
                                xs: '100%',
                                sm: 'auto',
                            },
                        }}
                    >
                        Got it
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
