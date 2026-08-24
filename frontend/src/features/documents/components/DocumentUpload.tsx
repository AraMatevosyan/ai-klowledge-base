'use client';

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Box,
    Button,
    Collapse,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { useUploadDocument } from '../documents.queries';
import { useAppOperationState } from '@/lib/app-operation';

const MAX_PDF_SIZE = 10 * 1024 * 1024;

function formatFileSize(size: number) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function DocumentUpload() {
    const inputRef = useRef<HTMLInputElement>(null);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    const [validationError, setValidationError] = useState<string | null>(null);

    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const uploadMutation = useUploadDocument();

    const { isBusy, isRetrying, isStreaming } = useAppOperationState();

    useEffect(() => {
        if (!validationError && !requestError && !successMessage) return;

        const timer = setTimeout(() => {
            setValidationError('');
            setSuccessMessage('');
        }, 3000);

        return () => clearTimeout(timer);
    }, [validationError, successMessage]);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0] ?? null;

        setValidationError(null);
        setSuccessMessage(null);
        uploadMutation.reset();

        if (!file) {
            setSelectedFile(null);
            return;
        }

        const isPdf =
            file.type === 'application/pdf' ||
            file.name.toLowerCase().endsWith('.pdf');

        if (!isPdf) {
            setSelectedFile(null);
            setValidationError('Only PDF files are allowed');

            event.target.value = '';
            return;
        }

        if (file.size > MAX_PDF_SIZE) {
            setSelectedFile(null);
            setValidationError('The PDF file must not exceed 10 MB');

            event.target.value = '';
            return;
        }

        setSelectedFile(file);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!selectedFile) {
            setValidationError('Please select a PDF file first');
            return;
        }

        setValidationError(null);
        setSuccessMessage(null);

        try {
            const result = await uploadMutation.mutateAsync(selectedFile);

            setSuccessMessage(
                `Document "${result.document.name}" was uploaded successfully`,
            );

            setSelectedFile(null);

            if (inputRef.current) {
                inputRef.current.value = '';
            }
        } catch {
            // The request error is displayed below.
        }
    };

    const requestError =
        uploadMutation.error instanceof Error
            ? uploadMutation.error.message
            : null;

    return (
        <Paper variant="outlined" sx={{ p: 3 }}>
            <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                    <Box>
                        <Typography variant="h6">Upload a document</Typography>

                        <Typography variant="body2" color="text.secondary">
                            PDF only, maximum file size: 10 MB
                        </Typography>
                    </Box>

                    <Stack
                        direction={{
                            xs: 'column',
                            sm: 'row',
                        }}
                        spacing={2}
                        // alignItems={{
                        //     xs: 'stretch',
                        //     sm: 'center',
                        // }}
                    >
                        <Button
                            component="label"
                            variant="outlined"
                            disabled={uploadMutation.isPending}
                        >
                            Select PDF
                            <input
                                ref={inputRef}
                                hidden
                                type="file"
                                accept=".pdf,application/pdf"
                                onChange={handleFileChange}
                                disabled={isBusy}
                            />
                        </Button>

                        <Button
                            type="submit"
                            variant="contained"
                            disabled={
                                !selectedFile ||
                                uploadMutation.isPending ||
                                isBusy
                            }
                        >
                            {uploadMutation.isPending
                                ? 'Uploading...'
                                : isRetrying
                                  ? 'Document processing is in progress'
                                  : isStreaming
                                    ? 'Wait for the answer'
                                    : 'Upload document'}
                        </Button>
                    </Stack>

                    {selectedFile && (
                        <Typography variant="body2">
                            {selectedFile.name}
                            {' — '}
                            {formatFileSize(selectedFile.size)}
                        </Typography>
                    )}

                    {uploadMutation.isPending && <LinearProgress />}

                    <Collapse in={!!validationError} timeout={300}>
                        <Alert severity="error">{validationError}</Alert>
                    </Collapse>

                    {requestError && (
                        <Alert severity="error">{requestError}</Alert>
                    )}

                    <Collapse in={!!successMessage} timeout={300}>
                        <Alert severity="success">{successMessage}</Alert>
                    </Collapse>
                </Stack>
            </Box>
        </Paper>
    );
}
