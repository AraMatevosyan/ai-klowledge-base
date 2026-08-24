'use client';

import { useState } from 'react';
import DeleteSweepOutlinedIcon from '@mui/icons-material/DeleteSweepOutlined';
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
import { useClearChatHistory } from '../chat.queries';

type ClearChatHistoryButtonProps = {
    disabled?: boolean;
    onCleared?: () => void;
};

export function ClearChatHistoryButton({
    disabled = false,
    onCleared,
}: ClearChatHistoryButtonProps) {
    const [open, setOpen] = useState(false);

    const clearMutation = useClearChatHistory();

    const handleOpen = () => {
        clearMutation.reset();
        setOpen(true);
    };

    const handleClose = () => {
        if (clearMutation.isPending) {
            return;
        }

        clearMutation.reset();
        setOpen(false);
    };

    const handleClear = () => {
        clearMutation.mutate(undefined, {
            onSuccess: () => {
                onCleared?.();
                setOpen(false);
            },
        });
    };

    const errorMessage =
        clearMutation.error instanceof Error
            ? clearMutation.error.message
            : null;

    return (
        <>
            <Button
                color="error"
                size="small"
                startIcon={<DeleteSweepOutlinedIcon />}
                disabled={disabled || clearMutation.isPending}
                onClick={handleOpen}
            >
                Clear history
            </Button>

            <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
                <DialogTitle>Clear chat history?</DialogTitle>

                <DialogContent>
                    <Stack spacing={2}>
                        <DialogContentText>
                            This will permanently delete all messages from your
                            chat. Uploaded documents will not be deleted.
                        </DialogContentText>

                        {errorMessage && (
                            <Alert severity="error">{errorMessage}</Alert>
                        )}
                    </Stack>
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={handleClose}
                        disabled={clearMutation.isPending}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={handleClear}
                        disabled={clearMutation.isPending}
                    >
                        {clearMutation.isPending
                            ? 'Clearing...'
                            : 'Clear history'}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
