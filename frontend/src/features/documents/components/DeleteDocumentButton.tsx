'use client';

import { useState } from 'react';
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Stack,
} from '@mui/material';
import { useDeleteDocument } from '../documents.queries';
import { useAppOperationState } from '@/lib/app-operation';

type DeleteDocumentButtonProps = {
    documentId: string;
    documentName: string;
};

export function DeleteDocumentButton({
    documentId,
    documentName,
}: DeleteDocumentButtonProps) {
    const [open, setOpen] = useState(false);
    const { isBusy } = useAppOperationState();

    const deleteMutation = useDeleteDocument();

    const handleOpen = () => {
        deleteMutation.reset();
        setOpen(true);
    };

    const handleClose = () => {
        if (deleteMutation.isPending) {
            return;
        }

        deleteMutation.reset();
        setOpen(false);
    };

    const handleDelete = () => {
        deleteMutation.mutate(documentId, {
            onSuccess: () => {
                setOpen(false);
            },
        });
    };

    const errorMessage =
        deleteMutation.error instanceof Error
            ? deleteMutation.error.message
            : null;

    return (
        <>
            <Button
                color="error"
                size="small"
                disabled={isBusy}
                onClick={handleOpen}
            >
                Delete
            </Button>

            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
                <DialogTitle>Delete document?</DialogTitle>

                <DialogContent>
                    <Stack spacing={2}>
                        <DialogContentText>
                            Are you sure you want to delete &quot;{documentName}
                            &quot;? This action cannot be undone.
                        </DialogContentText>

                        {errorMessage && (
                            <Alert severity="error">{errorMessage}</Alert>
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={handleClose}
                        disabled={deleteMutation.isPending}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending || isBusy}
                    >
                        {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
