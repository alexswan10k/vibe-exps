function BarcodeScanner({ onScanSuccess, onError, onClose }) {
    const [manualBarcode, setManualBarcode] = React.useState('');
    const scannerRef = React.useRef(null);
    const scannerId = "reader";

    React.useEffect(() => {
        // Initialize scanner when component mounts
        // We use a timeout to ensure the DOM element exists
        const timer = setTimeout(() => {
            if (window.Html5QrcodeScanner) {
                try {
                    scannerRef.current = new Html5QrcodeScanner(
                        scannerId,
                        {
                            fps: 10,
                            qrbox: { width: 250, height: 250 },
                            aspectRatio: 1.0
                        },
                        /* verbose= */ false
                    );

                    scannerRef.current.render(onScanSuccess, (errorMessage) => {
                        // Scan error is very verbose, usually we just ignore it for the UI
                        // unless it's critical. 
                        console.log(errorMessage);
                    });
                } catch (e) {
                    console.error("Failed to initialize scanner", e);
                    if (onError) onError(e);
                }
            } else {
                console.error("Html5QrcodeScanner not found");
                if (onError) onError("Scanner library not loaded");
            }
        }, 100);

        return () => {
            clearTimeout(timer);
            if (scannerRef.current) {
                try {
                    scannerRef.current.clear().catch(error => {
                        console.error("Failed to clear scanner", error);
                    });
                } catch (e) { /* ignore cleanup errors */ }
            }
        };
    }, []);

    const handleManualSubmit = (e) => {
        e.preventDefault();
        if (manualBarcode.trim()) {
            onScanSuccess(manualBarcode.trim());
        }
    };

    return React.createElement('div', { className: 'barcode-scanner-container' },
        React.createElement('div', { className: 'scanner-header' },
            React.createElement('h3', null, 'Scan Barcode'),
            React.createElement('button', { className: 'close-btn', onClick: onClose }, '×')
        ),
        React.createElement('div', { id: scannerId, className: 'scanner-viewport' }),
        React.createElement('div', { className: 'manual-entry' },
            React.createElement('form', { onSubmit: handleManualSubmit },
                React.createElement('input', {
                    type: 'text',
                    placeholder: 'Enter barcode manually',
                    value: manualBarcode,
                    onChange: (e) => setManualBarcode(e.target.value)
                }),
                React.createElement('button', { type: 'submit' }, 'Lookup')
            )
        )
    );
}

window.BarcodeScanner = BarcodeScanner;
