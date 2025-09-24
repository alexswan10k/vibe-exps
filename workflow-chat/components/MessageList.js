/**
 * MessageList Component
 * Displays the conversation messages with support for thinking blocks and tool calls
 */
function MessageList({ messages, onToggleSystemMessage }) {
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
        const messageClasses = `message ${message.role}-message`;
        const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleTimeString() : '';

        if (message.type === 'system-collapsed') {
            // Handle collapsible system message
            return React.createElement('div', { key: index, className: 'message system-message system-collapsed-message' },
                React.createElement('div', {
                    className: 'system-header',
                    onClick: () => toggleSystemMessage(index)
                },
                    React.createElement('span', null, '📋 System Prompt'),
                    React.createElement('span', { className: 'toggle-icon' }, message.collapsed ? '▶' : '▼'),
                    timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
                ),
                !message.collapsed && React.createElement('div', { className: 'system-content' },
                    React.createElement('pre', null, message.content)
                )
            );
        } else if (message.type === 'thinking') {
            // Handle thinking messages with collapsible content
            const fullContent = message.content;
            const thinkStart = fullContent.indexOf('<think>');
            const thinkEnd = fullContent.indexOf('</think>');

            let thinkingContent = '';
            let finalContent = fullContent;

            if (thinkStart !== -1 && thinkEnd !== -1) {
                thinkingContent = fullContent.substring(thinkStart + 7, thinkEnd);
                finalContent = fullContent.substring(0, thinkStart) + fullContent.substring(thinkEnd + 8);
            }

            return React.createElement('div', { key: index, className: 'message ai-message thinking-message' },
                React.createElement('div', { className: 'thinking-header' },
                    React.createElement('span', null, '🤔 Thinking...'),
                    React.createElement('span', { className: 'toggle-icon' }, '▼'),
                    timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
                ),
                React.createElement('div', { className: 'thinking-content' }, thinkingContent),
                finalContent.trim() && React.createElement('div', { className: 'final-content' }, finalContent.trim())
            );
        } else if (message.type === 'thinking-summary') {
            // Handle summarized thinking blocks
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
                    finalContent.trim() && React.createElement('div', { className: 'final-content' }, finalContent.trim())
                );
            }
        } else if (message.role === 'tool') {
            // Tool result messages
            return React.createElement('div', { key: index, className: 'message tool-message' },
                React.createElement('div', { className: 'tool-result' }, message.content),
                timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
            );
        }

        // Regular messages
        return React.createElement('div', { key: index, className: messageClasses },
            React.createElement('div', { className: 'message-content' }, message.content),
            timestamp && React.createElement('span', { className: 'timestamp' }, timestamp)
        );
    };

    return React.createElement('div', { className: 'message-list' },
        messages.length === 0 && React.createElement('div', { className: 'empty-messages' },
            React.createElement('p', null, 'Start a conversation to begin the workflow...')
        ),
        messages.map(renderMessage),
        React.createElement('div', { ref: messagesEndRef })
    );
}
