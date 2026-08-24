'use client';

import ReplayOutlinedIcon from '@mui/icons-material/ReplayOutlined';
import { Button, CircularProgress } from '@mui/material';
import { useRetryDocument } from '../documents.queries';
import { useAppOperationState } from '@/lib/app-operation';

type RetryDocumentButtonProps = {
    documentId: string;
};

export function RetryDocumentButton({ documentId }: RetryDocumentButtonProps) {
    const retryMutation = useRetryDocument();
    const { isBusy } = useAppOperationState();

    const handleRetry = () => {
        retryMutation.reset();
        retryMutation.mutate(documentId);
    };

    return (
        <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={
                retryMutation.isPending ? (
                    <CircularProgress size={16} color="inherit" />
                ) : (
                    <ReplayOutlinedIcon />
                )
            }
            disabled={isBusy}
            onClick={handleRetry}
        >
            {retryMutation.isPending ? 'Retrying...' : 'Retry'}
        </Button>
    );
}
