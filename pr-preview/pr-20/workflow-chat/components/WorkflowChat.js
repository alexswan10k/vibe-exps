/**
 * WorkflowChat Component
 * Main component that manages the workflow chat interface and LLM interactions
 */
function WorkflowChat({ workflowParams, llmConfig, onComplete, scenario = 'custom' }) {
    const [messages, setMessages] = React.useState([]);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState(null);
    const [tokensPerSecond, setTokensPerSecond] = React.useState(0);
    const [isAttemptingToolCall, setIsAttemptingToolCall] = React.useState(false);
    const abortControllerRef = React.useRef(null);
    const streamingStartTimeRef = React.useRef(null);
    const tokenCountRef = React.useRef(0);
    const messageInputRef = React.useRef(null);

// Expose globally for script tag loading
window.WorkflowChat = WorkflowChat;

    // Initialize workflow on mount
    React.useEffect(() => {
        initializeWorkflow();
    }, []);

    const initializeWorkflow = () => {
        // Add system message with workflow context (collapsed by default)
        const systemMessage = {
            role: 'system',
            content: WorkflowDomain.generateSystemPrompt(workflowParams.prompt, workflowParams.schema),
            timestamp: Date.now(),
            type: 'system-collapsed',
            collapsed: true
        };

        // Add initial assistant message to start conversation
        const initialMessage = {
            role: 'assistant',
            content: `Hello! I'm here to help you complete this workflow: ${workflowParams.prompt}\n\nWhat information can you provide to get started?`,
            timestamp: Date.now()
        };

        setMessages([systemMessage, initialMessage]);
    };

    const handleSendMessage = async (userMessage) => {
        if (isLoading) return;

        // Add user message
        const userMsg = {
            role: 'user',
            content: userMessage,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMsg]);
        setIsLoading(true);
        setError(null);

        try {
            // Prepare messages for LLM (exclude system messages for API)
            const apiMessages = messages
                .filter(msg => msg.role !== 'system')
                .concat(userMsg)
                .map(msg => ({
                    role: msg.role,
                    content: msg.content
                }));

            // Add system message at the beginning
            const systemMsg = messages.find(msg => msg.role === 'system');
            if (systemMsg) {
                apiMessages.unshift({
                    role: 'system',
                    content: systemMsg.content
                });
            }

            // Create complete tool
            const completeTool = WorkflowDomain.createCompleteTool(workflowParams.schema);

            // Send to LLM
            const result = await LLMService.sendMessage(apiMessages, llmConfig, [completeTool]);

            if (!result.success) {
                throw new Error(result.error);
            }

            // Initialize streaming metrics
            streamingStartTimeRef.current = Date.now();
            tokenCountRef.current = 0;
            setTokensPerSecond(0);

            // Add initial streaming message to messages array
            const streamingMessageIndex = messages.length + 1; // +1 because we already added user message
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: '',
                type: 'normal',
                timestamp: Date.now()
            }]);

            await LLMService.processStreamingResponse(
                result.response,
                handleStreamChunk,
                handleStreamComplete,
                handleStreamError,
                handleToolCallAttempt
            );

        } catch (err) {
            console.error('Error sending message:', err);
            setError(err.message);
            setIsLoading(false);
        }
    };

    const handleStreamChunk = (chunk) => {
        // Update token count and TPS
        if (chunk.content) {
            tokenCountRef.current += 1;
            const elapsedSeconds = (Date.now() - streamingStartTimeRef.current) / 1000;
            const tps = elapsedSeconds > 0 ? (tokenCountRef.current / elapsedSeconds).toFixed(1) : 0;
            setTokensPerSecond(tps);
        }

        setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];

            if (lastMsg) {
                let newContent = lastMsg.content + chunk.content;
                let newType = 'normal'; // Default to normal

                // Update message type based on accumulated content containing thinking tags
                if (newContent.includes('<think>')) {
                    newType = 'thinking';
                }

                lastMsg.content = newContent;
                lastMsg.type = newType;
            }

            return newMessages;
        });
    };

    const handleStreamComplete = (result) => {
        // Calculate final TPS
        const elapsedSeconds = streamingStartTimeRef.current ? (Date.now() - streamingStartTimeRef.current) / 1000 : 0;
        const finalTps = elapsedSeconds > 0 && tokenCountRef.current > 0 ? (tokenCountRef.current / elapsedSeconds).toFixed(1) : 0;

        setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];

            if (lastMsg) {
                // Content is already properly formatted with <think> tags from streaming
                lastMsg.content = result.content;
                lastMsg.type = result.thinkingContent ? 'thinking' : 'normal';
                lastMsg.tps = finalTps;
                // Collapse thinking section by default when complete
                if (result.thinkingContent) {
                    lastMsg.collapsed = true;
                }
            }

            return newMessages;
        });

        setIsLoading(false);
        setTokensPerSecond(0);

        // Focus the input after streaming completes
        setTimeout(() => {
            if (messageInputRef.current) {
                messageInputRef.current.focus();
            }
        }, 100);

        // Handle tool calls
        if (result.toolCalls && result.toolCalls.length > 0) {
            // Show tool call feedback briefly before processing
            setIsAttemptingToolCall(true);
            setTimeout(() => {
                setIsAttemptingToolCall(false);
                handleToolCalls(result.toolCalls);
            }, 1000); // Show for 1 second
        } else {
            setIsAttemptingToolCall(false);
        }
    };

    const handleStreamError = (error) => {
        console.error('Streaming error:', error);
        setError('Error receiving response from LLM');
        setIsLoading(false);
        setTokensPerSecond(0);
        setIsAttemptingToolCall(false);
    };

    const handleToolCallAttempt = (toolCalls) => {
        setIsAttemptingToolCall(true);
    };

    const handleToolCalls = (toolCalls) => {
        for (const toolCall of toolCalls) {
            if (toolCall.function.name === 'complete') {
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const payload = args.payload;

                    // Validate payload against schema
                    const validation = WorkflowDomain.validatePayload(payload, workflowParams.schema);
                    if (!validation.isValid) {
                        // Add error message to chat
                        const errorMsg = {
                            role: 'assistant',
                            content: `I tried to complete the workflow, but there were validation errors:\n${validation.errors.join('\n')}`,
                            timestamp: Date.now()
                        };
                        setMessages(prev => [...prev, errorMsg]);
                        return;
                    }

                    // Add completion message
                    const completeMsg = {
                        role: 'tool',
                        content: `✅ Workflow completed successfully! Returning to ${workflowParams.returnUrl}`,
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, completeMsg]);

                    // Complete workflow after a short delay with metadata
                    setTimeout(() => {
                        WorkflowDomain.completeWorkflow(payload, workflowParams.returnUrl, {
                            scenario,
                            schemaValidation: validation,
                            prompt: workflowParams.prompt
                        });
                    }, 1500);

                } catch (err) {
                    console.error('Error parsing complete tool arguments:', err);
                    const errorMsg = {
                        role: 'assistant',
                        content: 'Error completing workflow: Invalid tool arguments',
                        timestamp: Date.now()
                    };
                    setMessages(prev => [...prev, errorMsg]);
                }
            }
        }
    };

    const stopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        setIsLoading(false);
        setIsAttemptingToolCall(false);
    };

    return React.createElement('div', { className: 'workflow-chat' },
        React.createElement('div', { className: 'chat-header' },
            React.createElement('h2', null, 'Workflow Assistant'),
            React.createElement('div', { className: 'workflow-info' },
                React.createElement('small', null, `Completing: ${workflowParams.prompt.substring(0, 50)}...`)
            )
        ),

        error && React.createElement('div', { className: 'error-banner' },
            React.createElement('span', null, `⚠️ ${error}`),
            React.createElement('button', { onClick: () => setError(null) }, '×')
        ),

        React.createElement('div', { className: 'chat-container' },
            React.createElement(MessageList, {
                messages,
                onToggleSystemMessage: (index) => {
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const msg = newMessages[index];
                        if (msg && msg.type === 'system-collapsed') {
                            msg.collapsed = !msg.collapsed;
                        }
                        return newMessages;
                    });
                },
                onToggleThinkingMessage: (index) => {
                    setMessages(prev => {
                        const newMessages = [...prev];
                        const msg = newMessages[index];
                        if (msg && msg.type === 'thinking') {
                            msg.collapsed = !msg.collapsed;
                        }
                        return newMessages;
                    });
                }
            }),

            React.createElement('div', { className: 'input-section' },
                React.createElement(MessageInput, {
                    ref: messageInputRef,
                    onSendMessage: handleSendMessage,
                    disabled: isLoading,
                    placeholder: isLoading ? (isAttemptingToolCall ? 'AI is calling tools...' : 'AI is thinking...') : 'Type your response...'
                }),

                isLoading && React.createElement('button', {
                    onClick: stopGeneration,
                    className: 'stop-button'
                }, '⏹️ Stop'),

                isAttemptingToolCall && React.createElement('div', { className: 'tool-call-indicator' },
                    React.createElement('small', null, '🔧 Attempting tool call...')
                )
            )
        )
    );
}
