/**
 * MessageInput Component
 * Handles user input with support for sending messages and keyboard shortcuts
 */
const MessageInput = React.forwardRef(function MessageInput({ onSendMessage, disabled = false, placeholder = "Type your message..." }, ref) {
    const [message, setMessage] = React.useState('');
    const textareaRef = React.useRef(null);

    // Forward ref to textarea
    React.useImperativeHandle(ref, () => ({
        focus: () => {
            if (textareaRef.current) {
                textareaRef.current.focus();
            }
        }
    }));

// Expose globally for script tag loading
window.MessageInput = MessageInput;

    // Auto-resize textarea based on content
    React.useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    }, [message]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (message.trim() && !disabled) {
            onSendMessage(message.trim());
            setMessage('');
            // Refocus on textarea after sending message
            setTimeout(() => {
                if (textareaRef.current) {
                    textareaRef.current.focus();
                }
            }, 0);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return React.createElement('form', { onSubmit: handleSubmit, className: 'message-input-form' },
        React.createElement('div', { className: 'input-container' },
            React.createElement('textarea', {
                ref: textareaRef,
                value: message,
                onChange: (e) => setMessage(e.target.value),
                onKeyDown: handleKeyDown,
                placeholder: placeholder,
                disabled: disabled,
                rows: 1,
                className: 'message-textarea'
            }),
            React.createElement('button', {
                type: 'submit',
                disabled: disabled || !message.trim(),
                className: 'send-button',
                title: 'Send message (Enter)'
            }, disabled ? '⏳' : '📤')
        ),
        React.createElement('div', { className: 'input-help' },
            React.createElement('small', null, 'Press Enter to send, Shift+Enter for new line')
        )
    );
});
