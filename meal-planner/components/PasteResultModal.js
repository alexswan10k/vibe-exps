function PasteResultModal({
    show,
    pastedResult,
    onPastedResultChange,
    onImport,
    onCancel
}) {
    if (!show) return null;

    return React.createElement('div', { className: 'modal-overlay' },
        React.createElement('div', { className: 'modal paste-modal' },
            React.createElement('h2', null, 'Paste LLM Result'),
            React.createElement('p', null, 'Paste the JSON response from your preferred LLM (ChatGPT, Claude, etc.)'),
            React.createElement('textarea', {
                value: pastedResult,
                onChange: onPastedResultChange,
                placeholder: 'Paste the JSON response here...',
                rows: 15,
                className: 'paste-textarea'
            }),
            React.createElement('div', { className: 'modal-buttons' },
                React.createElement('button', { onClick: onImport }, 'Import Recipe'),
                React.createElement('button', { onClick: onCancel }, 'Cancel')
            )
        )
    );
}
