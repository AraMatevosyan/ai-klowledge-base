'use client';

import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
    Tooltip,
} from '@mui/material';
import { useDocuments } from '../documents.queries';
import type { DocumentStatus } from '../documents.types';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { DeleteDocumentButton } from '@/features/documents/components/DeleteDocumentButton';
import { RetryDocumentButton } from '@/features/documents/components/RetryDocumentButton';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

const statusConfig: Record<
    DocumentStatus,
    {
        label: string;
        color: 'default' | 'info' | 'warning' | 'success' | 'error';
    }
> = {
    UPLOADING: {
        label: 'Uploading',
        color: 'info',
    },
    PROCESSING: {
        label: 'Processing',
        color: 'warning',
    },
    READY: {
        label: 'Ready',
        color: 'success',
    },
    FAILED: {
        label: 'Failed',
        color: 'error',
    },
};

function formatFileSize(size: number) {
    if (size < 1024 * 1024) {
        return `${(size / 1024).toFixed(1)} KB`;
    }

    return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: string) {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

export function DocumentsList() {
    const { data, isPending, isError, error } = useDocuments();

    if (isPending) {
        return (
            <Paper variant="outlined" sx={{ p: 4 }}>
                <Stack
                    // alignItems="center"
                    spacing={2}
                >
                    <CircularProgress size={28} />

                    <Typography color="text.secondary">
                        Loading documents...
                    </Typography>
                </Stack>
            </Paper>
        );
    }

    if (isError) {
        return (
            <Alert severity="error">
                {error instanceof Error
                    ? error.message
                    : 'Failed to load documents'}
            </Alert>
        );
    }

    const documents = data.documents;

    if (documents.length === 0) {
        return (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
                <Box
                    sx={{
                        width: 72,
                        height: 72,
                        display: 'grid',
                        placeItems: 'center',
                        borderRadius: 3,
                        color: 'primary.main',
                        bgcolor: '#eeeeff',
                        mx: 'auto',
                    }}
                >
                    <DescriptionOutlinedIcon sx={{ fontSize: 34 }} />
                </Box>
                <Typography variant="h6">No documents yet</Typography>

                <Typography color="text.secondary">
                    Upload your first PDF to start building your knowledge base.
                </Typography>
            </Paper>
        );
    }

    return (
        <Stack spacing={2}>
            <Typography variant="h6">My documents</Typography>

            <TableContainer
                component={Paper}
                variant="outlined"
                sx={{
                    display: {
                        xs: 'none',
                        md: 'block',
                    },
                }}
            >
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Size</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Pages</TableCell>
                            <TableCell>Chunks</TableCell>
                            <TableCell>Uploaded</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {documents.map((document) => {
                            const status = statusConfig[document.status];

                            return (
                                <TableRow key={document.id}>
                                    <TableCell>
                                        <Stack spacing={0.5}>
                                            <Typography variant="body2">
                                                {document.name}
                                            </Typography>

                                            {document.status === 'FAILED' &&
                                                document.errorMessage && (
                                                    <Tooltip
                                                        title={
                                                            document.errorMessage
                                                        }
                                                        placement="bottom-start"
                                                    >
                                                        <Stack
                                                            direction="row"
                                                            spacing={0.5}
                                                            // alignItems="center"
                                                            sx={{
                                                                color: 'error.main',
                                                                maxWidth: 260,
                                                            }}
                                                        >
                                                            <ErrorOutlineOutlinedIcon
                                                                sx={{
                                                                    fontSize: 16,
                                                                    flexShrink: 0,
                                                                }}
                                                            />

                                                            <Typography
                                                                variant="caption"
                                                                noWrap
                                                                sx={{
                                                                    overflow:
                                                                        'hidden',
                                                                    textOverflow:
                                                                        'ellipsis',
                                                                }}
                                                            >
                                                                {
                                                                    document.errorMessage
                                                                }
                                                            </Typography>
                                                        </Stack>
                                                    </Tooltip>
                                                )}
                                        </Stack>
                                    </TableCell>

                                    <TableCell>
                                        {formatFileSize(document.size)}
                                    </TableCell>

                                    <TableCell>
                                        <Chip
                                            label={status.label}
                                            color={status.color}
                                            size="small"
                                        />
                                    </TableCell>

                                    <TableCell>
                                        {document.pageCount ?? '—'}
                                    </TableCell>

                                    <TableCell>{document.chunkCount}</TableCell>

                                    <TableCell>
                                        {formatDate(document.createdAt)}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack
                                            direction="row"
                                            // spacing={1}
                                            // alignItems="center"
                                            // justifyContent="flex-end"
                                        >
                                            {document.status === 'FAILED' && (
                                                <RetryDocumentButton
                                                    documentId={document.id}
                                                />
                                            )}

                                            <DeleteDocumentButton
                                                documentId={document.id}
                                                documentName={document.name}
                                            />
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
            <Stack
                spacing={1.5}
                sx={{
                    display: {
                        xs: 'flex',
                        md: 'none',
                    },
                }}
            >
                {documents.map((document) => {
                    const status = statusConfig[document.status];

                    const isFailed = document.status === 'FAILED';

                    return (
                        <Paper
                            key={document.id}
                            variant="outlined"
                            sx={{
                                p: 2,
                                borderColor: isFailed
                                    ? 'error.light'
                                    : 'divider',
                            }}
                        >
                            <Stack spacing={2}>
                                <Stack
                                    direction="row"
                                    spacing={1.5}
                                    // alignItems="flex-start"
                                    sx={{ justifyContent: 'space-between' }}
                                >
                                    <Box
                                        sx={{
                                            minWidth: 0,
                                        }}
                                    >
                                        <Typography
                                            // fontWeight={600}
                                            title={document.name}
                                            sx={{
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {document.name}
                                        </Typography>

                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {formatFileSize(document.size)}
                                        </Typography>
                                    </Box>

                                    <Chip
                                        label={status.label}
                                        color={status.color}
                                        size="small"
                                        sx={{
                                            flexShrink: 0,
                                        }}
                                    />
                                </Stack>

                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns:
                                            'repeat(2, minmax(0, 1fr))',
                                        gap: 1.5,
                                    }}
                                >
                                    <Box>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            Pages
                                        </Typography>

                                        <Typography variant="body2">
                                            {document.pageCount ?? '—'}
                                        </Typography>
                                    </Box>

                                    <Box>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            Chunks
                                        </Typography>

                                        <Typography variant="body2">
                                            {document.chunkCount}
                                        </Typography>
                                    </Box>

                                    <Box
                                        sx={{
                                            gridColumn: '1 / -1',
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            Uploaded
                                        </Typography>

                                        <Typography variant="body2">
                                            {formatDate(document.createdAt)}
                                        </Typography>
                                    </Box>
                                </Box>

                                {isFailed && document.errorMessage && (
                                    <Stack
                                        direction="row"
                                        spacing={0.75}
                                        // alignItems="flex-start"
                                        sx={{
                                            p: 1.25,
                                            borderRadius: 1.5,
                                            color: 'error.main',
                                            bgcolor: 'rgba(211, 47, 47, 0.06)',
                                        }}
                                    >
                                        <ErrorOutlineOutlinedIcon
                                            sx={{
                                                mt: '2px',
                                                fontSize: 18,
                                                flexShrink: 0,
                                            }}
                                        />

                                        <Typography variant="caption">
                                            {document.errorMessage}
                                        </Typography>
                                    </Stack>
                                )}

                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        justifyContent: 'flex-end',
                                        flexWrap: 'wrap',
                                    }}
                                    useFlexGap
                                >
                                    {isFailed && (
                                        <RetryDocumentButton
                                            documentId={document.id}
                                        />
                                    )}

                                    <DeleteDocumentButton
                                        documentId={document.id}
                                        documentName={document.name}
                                    />
                                </Stack>
                            </Stack>
                        </Paper>
                    );
                })}
            </Stack>
        </Stack>
    );
}
