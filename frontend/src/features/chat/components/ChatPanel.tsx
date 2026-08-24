'use client';

import {
    type FormEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Paper,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useDocuments } from '@/features/documents/documents.queries';
import { askQuestionStream } from '../chat.api';
import type { ChatMessage } from '../chat.types';
import { useChatMessages } from '../chat.queries';
import { ClearChatHistoryButton } from './ClearChatHistoryButton';
import { appOperationKeys, useAppOperationState } from '@/lib/app-operation';
import { useMutation } from '@tanstack/react-query';

function createMessageId() {
    return crypto.randomUUID();
}

export function ChatPanel() {
    const [question, setQuestion] = useState('');

    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [hasReceivedDelta, setHasReceivedDelta] = useState(false);

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const formRef = useRef<HTMLFormElement>(null);

    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    const documentsQuery = useDocuments();

    const chatMessagesQuery = useChatMessages();

    const historyInitializedRef = useRef(false);

    const documents = documentsQuery.data?.documents ?? [];

    const hasDocuments = documents.length > 0;

    const hasReadyDocuments = documents.some(
        (document) => document.status === 'READY' && document.chunkCount > 0,
    );

    const streamMutation = useMutation({
        mutationKey: appOperationKeys.streaming,

        mutationFn: askQuestionStream,
    });

    const { isBusy, isUploading, isRetrying } = useAppOperationState();

    const isStreaming = streamMutation.isPending;

    const canSubmit =
        question.trim().length >= 2 &&
        hasReadyDocuments &&
        !isBusy &&
        !chatMessagesQuery.isLoading;

    useEffect(() => {
        if (historyInitializedRef.current || !chatMessagesQuery.data) {
            return;
        }

        historyInitializedRef.current = true;

        setMessages(chatMessagesQuery.data.messages);
    }, [chatMessagesQuery.data]);

    useEffect(() => {
        const container = messagesContainerRef.current;

        if (!container) {
            return;
        }

        container.scrollTo({
            top: container.scrollHeight,
            behavior: isStreaming ? 'auto' : 'smooth',
        });
    }, [messages, isStreaming, hasReceivedDelta]);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
        };
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const normalizedQuestion = question.trim();

        if (normalizedQuestion.length < 2 || !hasReadyDocuments || isBusy) {
            return;
        }

        const userMessage: ChatMessage = {
            id: createMessageId(),
            role: 'user',
            content: normalizedQuestion,
        };

        const assistantMessageId = createMessageId();

        setMessages((currentMessages) => [...currentMessages, userMessage]);

        setQuestion('');
        setErrorMessage(null);
        setHasReceivedDelta(false);

        const abortController = new AbortController();

        abortControllerRef.current = abortController;

        let assistantMessageAdded = false;

        try {
            await streamMutation.mutateAsync({
                question: normalizedQuestion,
                signal: abortController.signal,

                onEvent: (streamEvent) => {
                    if (streamEvent.type === 'delta') {
                        if (!streamEvent.content) {
                            return;
                        }

                        setHasReceivedDelta(true);

                        if (!assistantMessageAdded) {
                            assistantMessageAdded = true;

                            setMessages((currentMessages) => [
                                ...currentMessages,
                                {
                                    id: assistantMessageId,
                                    role: 'assistant',
                                    content: streamEvent.content,
                                },
                            ]);

                            return;
                        }

                        setMessages((currentMessages) =>
                            currentMessages.map((message) =>
                                message.id === assistantMessageId
                                    ? {
                                          ...message,
                                          content:
                                              message.content +
                                              streamEvent.content,
                                      }
                                    : message,
                            ),
                        );
                    }

                    if (streamEvent.type === 'complete') {
                        const { answer, status, sources } = streamEvent.data;

                        if (!assistantMessageAdded) {
                            assistantMessageAdded = true;

                            setMessages((currentMessages) => [
                                ...currentMessages,
                                {
                                    id: assistantMessageId,
                                    role: 'assistant',
                                    content: answer,
                                    status,
                                    sources,
                                },
                            ]);

                            return;
                        }

                        setMessages((currentMessages) =>
                            currentMessages.map((message) =>
                                message.id === assistantMessageId
                                    ? {
                                          ...message,
                                          content: answer,
                                          status,
                                          sources,
                                      }
                                    : message,
                            ),
                        );
                    }
                },
            });
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return;
            }

            setMessages((currentMessages) =>
                currentMessages.filter(
                    (message) => message.id !== assistantMessageId,
                ),
            );

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Unable to generate an answer. Please try again.',
            );
        } finally {
            if (abortControllerRef.current === abortController) {
                abortControllerRef.current = null;
            }

            setHasReceivedDelta(false);
        }
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            formRef.current?.requestSubmit();
        }
    };

    return (
        <Paper
            variant="outlined"
            sx={{
                p: {
                    xs: 1.5,
                    sm: 3,
                },
                overflow: 'hidden',
            }}
        >
            <Stack
                spacing={{
                    xs: 2,
                    sm: 3,
                }}
            >
                <Stack
                    direction={{
                        xs: 'column',
                        sm: 'row',
                    }}
                    spacing={2}
                    sx={{
                        alignItems: {
                            xs: 'stretch',
                            sm: 'flex-start',
                        },
                        justifyContent: 'space-between',
                    }}
                >
                    <Box>
                        <Typography
                            variant="h5"
                            sx={{
                                fontSize: {
                                    xs: '1.2rem',
                                    sm: '1.5rem',
                                },
                            }}
                        >
                            Ask your knowledge base
                        </Typography>

                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                        >
                            Ask questions based on your uploaded documents.
                        </Typography>
                    </Box>

                    <Box
                        sx={{
                            flexShrink: 0,

                            '& .MuiButton-root': {
                                width: {
                                    xs: '100%',
                                    sm: 'auto',
                                },
                            },
                        }}
                    >
                        <ClearChatHistoryButton
                            disabled={messages.length === 0 || isBusy}
                            onCleared={() => {
                                setMessages([]);
                            }}
                        />
                    </Box>
                </Stack>

                {documentsQuery.isError && (
                    <Alert severity="error">
                        Failed to check document availability.
                    </Alert>
                )}

                {!documentsQuery.isLoading && !hasDocuments && (
                    <Alert severity="info">
                        Upload at least one document before asking questions.
                    </Alert>
                )}

                {!documentsQuery.isLoading &&
                    hasDocuments &&
                    !hasReadyDocuments && (
                        <Alert severity="warning">
                            Wait until at least one document is ready.
                        </Alert>
                    )}

                <Box
                    ref={messagesContainerRef}
                    sx={{
                        height: {
                            xs: '55dvh',
                            sm: 520,
                        },
                        minHeight: {
                            xs: 320,
                            sm: 380,
                        },
                        maxHeight: 520,
                        overflowY: 'auto',
                        overscrollBehavior: 'contain',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        p: {
                            xs: 1,
                            sm: 2,
                        },
                        bgcolor: 'background.default',
                    }}
                >
                    {!chatMessagesQuery.isLoading &&
                        messages.length === 0 &&
                        !isStreaming && (
                            <Box
                                sx={{
                                    minHeight: 280,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    textAlign: 'center',
                                }}
                            >
                                <Typography color="text.secondary">
                                    Ask a question about your uploaded
                                    documents.
                                </Typography>
                            </Box>
                        )}

                    <Stack spacing={2}>
                        {chatMessagesQuery.isLoading && (
                            <Box
                                sx={{
                                    minHeight: 280,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    // alignItems="center"
                                >
                                    <CircularProgress size={20} />

                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Loading conversation...
                                    </Typography>
                                </Stack>
                            </Box>
                        )}

                        {messages.map((message) => (
                            <Box
                                key={message.id}
                                sx={{
                                    display: 'flex',
                                    justifyContent:
                                        message.role === 'user'
                                            ? 'flex-end'
                                            : 'flex-start',
                                }}
                            >
                                <Paper
                                    elevation={0}
                                    sx={{
                                        maxWidth: {
                                            xs: '94%',
                                            sm: '85%',
                                        },
                                        minWidth: 0,
                                        overflow: 'hidden',
                                        p: {
                                            xs: 1.25,
                                            sm: 2,
                                        },
                                        borderRadius: 2,
                                        bgcolor:
                                            message.role === 'user'
                                                ? 'primary.main'
                                                : 'background.paper',
                                        color:
                                            message.role === 'user'
                                                ? 'primary.contrastText'
                                                : 'text.primary',
                                        border:
                                            message.role === 'assistant'
                                                ? 1
                                                : 0,
                                        borderColor: 'divider',
                                    }}
                                >
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            whiteSpace: 'pre-wrap',
                                            overflowWrap: 'anywhere',
                                        }}
                                    >
                                        {message.content}
                                    </Typography>

                                    {message.sources &&
                                        message.sources.length > 0 && (
                                            <Stack
                                                spacing={1}
                                                sx={{
                                                    mt: 2,
                                                }}
                                            >
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    Sources
                                                </Typography>

                                                {message.sources.map(
                                                    (source) => (
                                                        <Paper
                                                            key={`${message.id}-${source.sourceNumber}`}
                                                            variant="outlined"
                                                            sx={{
                                                                maxWidth:
                                                                    '100%',
                                                                overflow:
                                                                    'hidden',
                                                                p: {
                                                                    xs: 1.25,
                                                                    sm: 1.5,
                                                                },
                                                                bgcolor:
                                                                    'background.default',
                                                            }}
                                                        >
                                                            <Stack
                                                                direction={{
                                                                    xs: 'column',
                                                                    sm: 'row',
                                                                }}
                                                                spacing={1}
                                                                // alignItems={{
                                                                //     xs: 'flex-start',
                                                                //     sm: 'center',
                                                                // }}
                                                            >
                                                                <Chip
                                                                    size="small"
                                                                    label={`[${source.sourceNumber}]`}
                                                                />

                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        flexGrow: 1,
                                                                        minWidth: 0,
                                                                        overflowWrap:
                                                                            'anywhere',
                                                                    }}
                                                                >
                                                                    {
                                                                        source.documentName
                                                                    }
                                                                    {' · '}
                                                                    Page{' '}
                                                                    {
                                                                        source.pageNumber
                                                                    }
                                                                </Typography>
                                                            </Stack>

                                                            <Typography
                                                                variant="caption"
                                                                color="text.secondary"
                                                                sx={{
                                                                    display:
                                                                        'block',
                                                                    mt: 1,
                                                                    whiteSpace:
                                                                        'pre-wrap',
                                                                    overflowWrap:
                                                                        'anywhere',
                                                                }}
                                                            >
                                                                {source.excerpt}
                                                            </Typography>
                                                        </Paper>
                                                    ),
                                                )}
                                            </Stack>
                                        )}
                                </Paper>
                            </Box>
                        ))}

                        {isStreaming && !hasReceivedDelta && (
                            <Box
                                sx={{
                                    display: 'flex',
                                    justifyContent: 'flex-start',
                                }}
                            >
                                <Paper variant="outlined" sx={{ p: 2 }}>
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        // alignItems="center"
                                    >
                                        <CircularProgress size={18} />

                                        <Typography variant="body2">
                                            Searching documents...
                                        </Typography>
                                    </Stack>
                                </Paper>
                            </Box>
                        )}
                    </Stack>
                </Box>

                {errorMessage && <Alert severity="error">{errorMessage}</Alert>}

                {chatMessagesQuery.isError && (
                    <Alert severity="error">
                        Unable to load conversation history.
                    </Alert>
                )}

                <Box ref={formRef} component="form" onSubmit={handleSubmit}>
                    <Stack spacing={2}>
                        <TextField
                            fullWidth
                            multiline
                            minRows={2}
                            maxRows={5}
                            label="Ask a question"
                            placeholder="What are the main topics across my documents?"
                            value={question}
                            onChange={(event) =>
                                setQuestion(event.target.value)
                            }
                            onKeyDown={handleKeyDown}
                            disabled={
                                documentsQuery.isLoading ||
                                chatMessagesQuery.isLoading ||
                                !hasReadyDocuments ||
                                isBusy
                            }
                            helperText={
                                isUploading
                                    ? 'Wait until the document upload is complete.'
                                    : isRetrying
                                      ? 'Wait until document processing is complete.'
                                      : hasReadyDocuments
                                        ? 'Press Enter to send. Use Shift + Enter for a new line.'
                                        : 'A ready document is required.'
                            }
                        />

                        <Box
                            sx={{
                                display: 'flex',
                                justifyContent: 'flex-end',
                            }}
                        >
                            <Button
                                type="submit"
                                variant="contained"
                                disabled={!canSubmit}
                                sx={{
                                    width: {
                                        xs: '100%',
                                        sm: 'auto',
                                    },
                                }}
                            >
                                {isStreaming ? 'Generating...' : 'Send'}
                            </Button>
                        </Box>
                    </Stack>
                </Box>
            </Stack>
        </Paper>
    );
}
