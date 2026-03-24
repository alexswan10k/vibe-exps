/**
 * ThinkingSection Component
 * Displays the thinking content with collapsible functionality
 */
function ThinkingSection({ isComplete, thinkingContent, timestamp }) {
    const [collapsed, setCollapsed] = React.useState(false);

    // Auto-collapse when thinking is complete
    React.useEffect(() => {
        if (isComplete) {
            setCollapsed(true);
        }
    }, [isComplete]);

    const toggleCollapsed = () => {
        setCollapsed(!collapsed);
    };

    return React.createElement('div', { className: 'thinking-section' },
        React.createElement('div', {
            className: 'thinking-header',
            onClick: toggleCollapsed
        },
            React.createElement('span', null, '🤔 Thinking...'),
            React.createElement('span', { className: 'toggle-icon' }, collapsed ? '▶' : '▼'),
            timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
        ),
        !collapsed && React.createElement('div', { className: 'thinking-content' }, thinkingContent)
    );
}

/**
 * Message Component
 * Displays an individual message with thinking section if present
 */
function MessageComponent({ message, index, onToggleSystemMessage, onToggleThinkingMessage }) {
    const messageClasses = `message ${message.role}-message`;
    const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';

    // Debug logging
    console.log('Rendering message:', index, message.type, message.role, message.content?.substring(0, 50));

    if (message.type === 'system-collapsed') {
        return React.createElement('div', { key: index, className: 'message system-message system-collapsed-message' },
            React.createElement('div', {
                className: 'system-header',
                onClick: () => onToggleSystemMessage && onToggleSystemMessage(index)
            },
                React.createElement('span', null, '📋 System Prompt'),
                React.createElement('span', { className: 'toggle-icon' }, message.collapsed ? '▶' : '▼'),
                timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
            ),
            !message.collapsed && React.createElement('div', { className: 'system-content' },
                React.createElement('pre', null, message.content)
            )
        );
    }

    if (message.type === 'thinking') {
        const fullContent = message.content;
        const thinkStart = fullContent.indexOf('<think>');
        const thinkEnd = fullContent.indexOf('</think>');

        let thinkingContent = '';
        let finalContent = fullContent;
        let hasThinking = false;

        if (thinkStart !== -1) {
            hasThinking = true;
            if (thinkEnd !== -1) {
                // Complete thinking block
                thinkingContent = fullContent.substring(thinkStart + 7, thinkEnd);
                finalContent = fullContent.substring(0, thinkStart) + fullContent.substring(thinkEnd + 8);
            } else {
                // Incomplete thinking block
                thinkingContent = fullContent.substring(thinkStart + 7);
                finalContent = fullContent.substring(0, thinkStart);
            }
        }

        return React.createElement('div', { key: index, className: 'message ai-message' },
            hasThinking && React.createElement(ThinkingSection, {
                isComplete: thinkEnd !== -1,
                thinkingContent: thinkingContent,
                timestamp: timestamp
            }),
            finalContent.trim() && React.createElement('div', { className: 'message-content' }, finalContent.trim()),
            message.tps && React.createElement('div', { className: 'message-tps' }, `${message.tps} t/s`)
        );
    }

    if (message.type === 'normal') {
        return React.createElement('div', { key: index, className: messageClasses },
            React.createElement('div', { className: 'message-content' }, message.content),
            timestamp && React.createElement('span', { className: 'timestamp' }, timestamp),
            message.tps && React.createElement('div', { className: 'message-tps' }, `${message.tps} t/s`)
        );
    }

    if (message.type === 'thinking-summary') {
        const summaryMatch = message.content.match(/<think-summary original="([^"]*)">(.*?)<\/think-summary>(.*)/);
        if (summaryMatch) {
            const originalContent = atob(summaryMatch[1]);
            const summaryContent = summaryMatch[2];
            const finalContent = summaryMatch[3];

            return React.createElement('div', { key: index, className: 'message ai-message thinking-message' },
                React.createElement('div', { className: 'thinking-header' },
                    React.createElement('span', { style: { color: '#ff6b35' } }, '📝 Summarized Thinking...'),
                    React.createElement('span', { className: 'toggle-icon' }, '▼'),
                    timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
                ),
                React.createElement('div', { className: 'thinking-content' },
                    React.createElement('div', { style: { fontStyle: 'italic', color: '#666' } }, summaryContent),
                    React.createElement('button', {
                        style: { marginTop: '5px', fontSize: '12px', padding: '2px 6px' },
                        onClick: (e) => {
                            const contentDiv = e.target.parentElement;
                            if (e.target.textContent === 'Show Original') {
                                contentDiv.firstChild.textContent = originalContent;
                                contentDiv.firstChild.style.fontStyle = 'normal';
                                contentDiv.firstChild.style.color = 'inherit';
                                e.target.textContent = 'Show Summary';
                            } else {
                                contentDiv.firstChild.textContent = summaryContent;
                                contentDiv.firstChild.style.fontStyle = 'italic';
                                contentDiv.firstChild.style.color = '#666';
                                e.target.textContent = 'Show Original';
                            }
                        }
                    }, 'Show Original')
                ),
                finalContent.trim() && React.createElement('div', { className: 'final-content' }, finalContent.trim()),
                message.tps && React.createElement('div', { className: 'message-tps' }, `${message.tps} t/s`)
            );
        }
    }

    if (message.role === 'tool') {
        return React.createElement('div', { key: index, className: 'message tool-message' },
            React.createElement('div', { className: 'tool-result' }, message.content),
            timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
        );
    }

    // Regular messages
    return React.createElement('div', { key: index, className: messageClasses },
        React.createElement('div', { className: 'message-content' }, message.content),
        timestamp && React.createElement('span', { className: 'timestamp' }, timestamp),
        message.tps && React.createElement('div', { className: 'message-tps' }, `${message.tps} t/s`)
    );
}

/**
 * MessageList Component
 * Displays the conversation messages with support for thinking blocks and tool calls
 */
function MessageList({ messages, onToggleSystemMessage, onToggleThinkingMessage }) {
    const messagesEndRef = React.useRef(null);

// Expose globally for script tag loading
window.MessageList = MessageList;

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const toggleSystemMessage = (index) => {
        if (onToggleSystemMessage) {
            onToggleSystemMessage(index);
        }
    };

    const renderMessage = (message, index) => {
        return React.createElement(MessageComponent, {
            message: message,
            index: index,
            onToggleSystemMessage: toggleSystemMessage,
            onToggleThinkingMessage: onToggleThinkingMessage
        });
    };

    return React.createElement('div', { className: 'message-list' },
        messages.length === 0 && React.createElement('div', { className: 'empty-messages' },
            React.createElement('p', null, 'Start a conversation to begin the workflow...')
        ),
        messages.map(renderMessage),
        React.createElement('div', { ref: messagesEndRef })
    );
}
