function IngredientDropdown({ value, suggestions, onChange, placeholder }) {
    const [isOpen, setIsOpen] = useState(false);
    const [filteredSuggestions, setFilteredSuggestions] = useState([]);

    const handleInputChange = (e) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        if (inputValue.trim()) {
            const filtered = suggestions.filter(item =>
                item.toLowerCase().includes(inputValue.toLowerCase())
            );
            setFilteredSuggestions(filtered);
            setIsOpen(filtered.length > 0);
        } else {
            setIsOpen(false);
        }
    };

    const handleSuggestionClick = (suggestion) => {
        onChange(suggestion);
        setIsOpen(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            setIsOpen(false);
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    return React.createElement('div', { className: 'dropdown-container' },
        React.createElement('input', {
            type: 'text',
            value: value,
            onChange: handleInputChange,
            onKeyDown: handleKeyDown,
            onFocus: () => {
                if (value.trim() && filteredSuggestions.length > 0) {
                    setIsOpen(true);
                }
            },
            onBlur: () => {
                // Delay closing to allow click on suggestions
                setTimeout(() => setIsOpen(false), 150);
            },
            placeholder: placeholder,
            className: 'dropdown-input'
        }),
        isOpen && React.createElement('ul', { className: 'dropdown-list' },
            filteredSuggestions.slice(0, 5).map((suggestion, index) =>
                React.createElement('li', {
                    key: index,
                    onClick: () => handleSuggestionClick(suggestion),
                    className: 'dropdown-item'
                }, suggestion)
            )
        )
    );
}
