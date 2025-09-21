/**
 * Human Authorship Verifier - Core Verification Library
 * Provides cryptographic verification of human-authored content
 */

// Detect environment
const isBrowser = typeof window !== 'undefined' && typeof window.crypto !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Unified verification functions (same as hav-core.js for consistency)

async function generateTextHash(text) {
    if (isBrowser) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text.trim());
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } else if (isNode) {
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
    } else {
        throw new Error('Unsupported environment');
    }
}

async function verifyLog(log, text, signature, publicKey, signedData = null) {
    const result = {
        isValid: false,
        details: {
            signatureValid: false,
            textMatches: false,
            textHashValid: false,
            reconstructedText: '',
            errors: [],
            warnings: []
        }
    };

    try {
        // Reconstruct text from log
        const reconstructedText = reconstructText(log);
        result.details.reconstructedText = reconstructedText;

        // Compare texts
        result.details.textMatches = reconstructedText === text.trim();

        if (!result.details.textMatches) {
            result.details.errors.push('Displayed text does not match log reconstruction');
            return result;
        }

        let signatureValid = false;
        let verifiedTimestamp = null;

        // If signedData is provided (for testing), use it directly
        if (signedData) {
            if (isBrowser) {
                try {
                    // Import public key
                    const publicKeyObj = await crypto.subtle.importKey(
                        'jwk',
                        publicKey,
                        {
                            name: 'RSA-PSS',
                            hash: 'SHA-256',
                        },
                        false,
                        ['verify']
                    );

                    const encoder = new TextEncoder();
                    const dataBuffer = encoder.encode(JSON.stringify(signedData));
                    const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

                    signatureValid = await crypto.subtle.verify(
                        {
                            name: 'RSA-PSS',
                            saltLength: 32, // 256 bits for SHA-256
                        },
                        publicKeyObj,
                        signatureBuffer,
                        dataBuffer
                    );
                    verifiedTimestamp = signedData.timestamp;
                } catch (error) {
                    console.error('Direct verification failed:', error);
                }
            } else if (isNode) {
                try {
                    const crypto = require('crypto');
                    // Import public key
                    const publicKeyObj = crypto.createPublicKey({
                        key: publicKey,
                        format: 'jwk'
                    });

                    const verify = crypto.createVerify('RSA-SHA256');
                    verify.update(JSON.stringify(signedData));
                    const signatureBuffer = Buffer.from(signature, 'base64');

                    signatureValid = verify.verify(publicKeyObj, signatureBuffer);
                    verifiedTimestamp = signedData.timestamp;
                } catch (error) {
                    console.error('Direct verification failed:', error);
                }
            }
        } else {
            // For production use, try to guess the timestamp
            const now = Date.now();

            // Check a few recent timestamps (within last minute)
            for (let i = 0; i < 60 * 1000; i += 100) {
                const testTimestamp = now - i;
                const textHash = await generateTextHash(text);
                const testSignedData = {
                    log: log,
                    textHash: textHash,
                    timestamp: testTimestamp
                };

                if (isBrowser) {
                    try {
                        // Import public key
                        const publicKeyObj = await crypto.subtle.importKey(
                            'jwk',
                            publicKey,
                            {
                                name: 'RSA-PSS',
                                hash: 'SHA-256',
                            },
                            false,
                            ['verify']
                        );

                        const encoder = new TextEncoder();
                        const dataBuffer = encoder.encode(JSON.stringify(testSignedData));
                        const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

                        if (await crypto.subtle.verify(
                            {
                                name: 'RSA-PSS',
                                saltLength: 32, // 256 bits for SHA-256
                            },
                            publicKeyObj,
                            signatureBuffer,
                            dataBuffer
                        )) {
                            signatureValid = true;
                            verifiedTimestamp = testTimestamp;
                            break;
                        }
                    } catch (e) {
                        // Continue trying different timestamps
                    }
                } else if (isNode) {
                    try {
                        const crypto = require('crypto');
                        // Import public key
                        const publicKeyObj = crypto.createPublicKey({
                            key: publicKey,
                            format: 'jwk'
                        });

                        const verify = crypto.createVerify('RSA-SHA256');
                        verify.update(JSON.stringify(testSignedData));
                        const signatureBuffer = Buffer.from(signature, 'base64');

                        if (verify.verify(publicKeyObj, signatureBuffer)) {
                            signatureValid = true;
                            verifiedTimestamp = testTimestamp;
                            break;
                        }
                    } catch (e) {
                        // Continue trying different timestamps
                    }
                }
            }

            // If that didn't work, try the exact current time (for testing)
            if (!signatureValid) {
                const textHash = await generateTextHash(text);
                const testSignedData = {
                    log: log,
                    textHash: textHash,
                    timestamp: now
                };

                if (isBrowser) {
                    try {
                        // Import public key
                        const publicKeyObj = await crypto.subtle.importKey(
                            'jwk',
                            publicKey,
                            {
                                name: 'RSA-PSS',
                                hash: 'SHA-256',
                            },
                            false,
                            ['verify']
                        );

                        const encoder = new TextEncoder();
                        const dataBuffer = encoder.encode(JSON.stringify(testSignedData));
                        const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

                        if (await crypto.subtle.verify(
                            {
                                name: 'RSA-PSS',
                                saltLength: 32, // 256 bits for SHA-256
                            },
                            publicKeyObj,
                            signatureBuffer,
                            dataBuffer
                        )) {
                            signatureValid = true;
                            verifiedTimestamp = now;
                        }
                    } catch (e) {
                        // Continue
                    }
                } else if (isNode) {
                    try {
                        const crypto = require('crypto');
                        // Import public key
                        const publicKeyObj = crypto.createPublicKey({
                            key: publicKey,
                            format: 'jwk'
                        });

                        const verify = crypto.createVerify('RSA-SHA256');
                        verify.update(JSON.stringify(testSignedData));
                        const signatureBuffer = Buffer.from(signature, 'base64');

                        if (verify.verify(publicKeyObj, signatureBuffer)) {
                            signatureValid = true;
                            verifiedTimestamp = now;
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            }
        }

        result.details.signatureValid = signatureValid;

        if (!signatureValid) {
            result.details.errors.push('Invalid signature');
            return result;
        }

        // Verify text hash matches
        const expectedHash = await generateTextHash(text);
        const actualHash = await generateTextHash(reconstructedText);
        result.details.textHashValid = expectedHash === actualHash;

        if (!result.details.textHashValid) {
            result.details.errors.push('Text hash does not match');
            return result;
        }

        // Check for additional security features
        checkSecurityFeatures({ log, textHash: expectedHash, timestamp: verifiedTimestamp }, result.details);

        // Final validation
        result.isValid = result.details.signatureValid && result.details.textMatches && result.details.textHashValid;

    } catch (error) {
        result.details.errors.push(`Verification error: ${error.message}`);
        console.error('HAV Verification error:', error);
    }

    return result;
}

function reconstructText(log) {
    let text = '';

    for (const entry of log) {
        if (entry.type === 'diff' && entry.change) {
            if (entry.change.added) {
                // Insert text at position
                const pos = entry.change.pos || text.length;
                text = text.slice(0, pos) + entry.change.added + text.slice(pos);
            } else if (entry.change.removed) {
                // Remove text from position
                const pos = entry.change.pos || 0;
                const removeLength = entry.change.removed.length;
                text = text.slice(0, pos) + text.slice(pos + removeLength);
            }
        }
    }

    return text;
}

function checkSecurityFeatures(logData, details) {
    // Check for reasonable timestamp
    const now = Date.now();
    const logTime = logData.timestamp;

    if (Math.abs(now - logTime) > 365 * 24 * 60 * 60 * 1000) { // 1 year
        details.warnings.push('Log timestamp is unusually old or in the future');
    }

    // Check for minimum number of events (suggests human typing)
    if (logData.log.length < 3) {
        details.warnings.push('Very few events logged - may not indicate human authorship');
    }

    // Check for realistic typing patterns
    const keyEvents = logData.log.filter(e => e.type === 'keydown' || e.type === 'keyup');
    if (keyEvents.length > 0) {
        const avgInterval = calculateAverageInterval(keyEvents);
        if (avgInterval < 50) { // Less than 50ms between keystrokes
            details.warnings.push('Unusually fast typing detected');
        }
    }
}

function calculateAverageInterval(events) {
    if (events.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < events.length; i++) {
        intervals.push(events[i].time - events[i-1].time);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
}

class HumanAuthorshipVerifier {
    constructor(options = {}) {
        this.options = {
            timeout: options.timeout || 10000,
            checkFingerprint: options.checkFingerprint !== false,
            allowUnsigned: options.allowUnsigned || false,
            ...options
        };
    }

    /**
     * Main verification function
     * @param {HTMLElement|string} input - DOM element or HTML string to verify
     * @param {Object} options - Override default options
     * @returns {Promise<Object>} Verification result
     */
    async verify(input, options = {}) {
        const opts = { ...this.options, ...options };
        const result = {
            isValid: false,
            details: {
                signatureValid: false,
                textMatches: false,
                logAccessible: false,
                fingerprint: null,
                reconstructedText: '',
                errors: [],
                warnings: []
            }
        };

        try {
            // Parse input
            const element = this._parseInput(input);
            if (!element) {
                result.details.errors.push('Invalid input: must be DOM element or HTML string');
                return result;
            }

            // Extract data attributes
            const data = this._extractDataAttributes(element);
            if (!data) {
                if (!opts.allowUnsigned) {
                    result.details.errors.push('No authorship data found');
                }
                return result;
            }

            // Fetch log file
            const logData = await this._fetchLog(data.logUrl, opts.timeout);
            if (!logData) {
                result.details.errors.push('Could not fetch event log');
                return result;
            }
            result.details.logAccessible = true;

            // Verify signature
            const signatureValid = await this._verifySignature(logData, data.signature, data.publicKey);
            result.details.signatureValid = signatureValid;

            if (!signatureValid) {
                result.details.errors.push('Invalid signature');
                return result;
            }

            // Reconstruct text from log
            const reconstructedText = this._reconstructText(logData.log);
            result.details.reconstructedText = reconstructedText;

            // Get displayed text
            const displayedText = this._getDisplayedText(element);

            // Compare texts
            result.details.textMatches = reconstructedText === displayedText;

            if (!result.details.textMatches) {
                result.details.errors.push('Displayed text does not match log reconstruction');
                return result;
            }

            // Extract fingerprint if present
            if (opts.checkFingerprint && data.fingerprint) {
                result.details.fingerprint = data.fingerprint;
            }

            // Check for additional security features
            this._checkSecurityFeatures(logData, result.details);

            // Final validation
            result.isValid = result.details.signatureValid && result.details.textMatches && result.details.logAccessible;

        } catch (error) {
            result.details.errors.push(`Verification error: ${error.message}`);
            console.error('HAV Verification error:', error);
        }

        return result;
    }

    /**
     * Parse input into DOM element
     * @private
     */
    _parseInput(input) {
        if (input instanceof HTMLElement) {
            return input;
        }

        if (typeof input === 'string') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(input, 'text/html');
            // Find the first element with authorship data
            const elements = doc.querySelectorAll('[data-hav-key]');
            return elements.length > 0 ? elements[0] : null;
        }

        return null;
    }

    /**
     * Extract authorship data from element attributes
     * @private
     */
    _extractDataAttributes(element) {
        const keyAttr = element.getAttribute('data-hav-key');
        const logAttr = element.getAttribute('data-hav-log');
        const sigAttr = element.getAttribute('data-hav-signature');
        const fpAttr = element.getAttribute('data-hav-fingerprint');

        if (!keyAttr || !logAttr || !sigAttr) {
            console.warn('Missing required authorship attributes:', {
                hasKey: !!keyAttr,
                hasLog: !!logAttr,
                hasSignature: !!sigAttr
            });
            return null;
        }

        // Clean up the key attribute - base64 decode and parse as JSON
        let cleanKeyAttr = keyAttr.trim();

        // Try to base64 decode the public key (new format)
        try {
            cleanKeyAttr = atob(cleanKeyAttr);
        } catch (e) {
            // If base64 decode fails, assume it's the old format (plain JSON string)
            console.warn('Failed to base64 decode public key, trying legacy format');
        }

        // Parse the decoded string as JSON
        try {
            const publicKey = JSON.parse(cleanKeyAttr);
            return {
                publicKey,
                logUrl: logAttr,
                signature: sigAttr,
                fingerprint: fpAttr
            };
        } catch (error) {
            console.error('Error parsing public key JSON:', error);
            console.error('Raw key attribute:', keyAttr);
            console.error('Decoded key attribute:', cleanKeyAttr);
            return null;
        }
    }

    /**
     * Fetch and parse log file
     * @private
     */
    async _fetchLog(url, timeout) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(url, {
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Validate log structure
            if (!Array.isArray(data.log) || typeof data.timestamp !== 'number') {
                throw new Error('Invalid log file structure');
            }

            return data;
        } catch (error) {
            console.error('Error fetching log:', error);
            return null;
        }
    }

    /**
     * Verify cryptographic signature using core library
     * @private
     */
    async _verifySignature(logData, signature, publicKeyJwk) {
        try {
            // Use built-in verification function
            const result = await verifyLog(logData.log, '', signature, publicKeyJwk, logData);
            return result.details.signatureValid;
        } catch (error) {
            console.error('Signature verification error:', error);
            return false;
        }
    }

    /**
     * Reconstruct text from event log using core library
     * @private
     */
    _reconstructText(log) {
        try {
            // Use built-in text reconstruction
            return reconstructText(log);
        } catch (error) {
            console.error('Text reconstruction error:', error);
            return '';
        }
    }

    /**
     * Get displayed text from element
     * @private
     */
    _getDisplayedText(element) {
        // For text elements, get text content
        if (element.textContent) {
            return element.textContent.trim();
        }

        // For input/textarea elements
        if (element.value) {
            return element.value.trim();
        }

        return '';
    }

    /**
     * Check additional security features
     * @private
     */
    _checkSecurityFeatures(logData, details) {
        // Check for reasonable timestamp
        const now = Date.now();
        const logTime = logData.timestamp;

        if (Math.abs(now - logTime) > 365 * 24 * 60 * 60 * 1000) { // 1 year
            details.warnings.push('Log timestamp is unusually old or in the future');
        }

        // Check for minimum number of events (suggests human typing)
        if (logData.log.length < 3) {
            details.warnings.push('Very few events logged - may not indicate human authorship');
        }

        // Check for realistic typing patterns
        const keyEvents = logData.log.filter(e => e.type === 'keydown' || e.type === 'keyup');
        if (keyEvents.length > 0) {
            const avgInterval = this._calculateAverageInterval(keyEvents);
            if (avgInterval < 50) { // Less than 50ms between keystrokes
                details.warnings.push('Unusually fast typing detected');
            }
        }
    }

    /**
     * Calculate average interval between events
     * @private
     */
    _calculateAverageInterval(events) {
        if (events.length < 2) return 0;

        const intervals = [];
        for (let i = 1; i < events.length; i++) {
            intervals.push(events[i].time - events[i-1].time);
        }

        return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    }

    /**
     * Batch verify multiple elements
     * @param {HTMLElement[]} elements - Array of elements to verify
     * @param {Object} options - Verification options
     * @returns {Promise<Object[]>} Array of verification results
     */
    async verifyBatch(elements, options = {}) {
        const results = await Promise.allSettled(
            elements.map(element => this.verify(element, options))
        );

        return results.map((result, index) => ({
            element: elements[index],
            success: result.status === 'fulfilled',
            result: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
        }));
    }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HumanAuthorshipVerifier;
} else if (typeof window !== 'undefined') {
    window.HumanAuthorshipVerifier = HumanAuthorshipVerifier;
}

// Convenience function for quick verification
async function verifyAuthorship(input, options = {}) {
    const verifier = new HumanAuthorshipVerifier(options);
    return await verifier.verify(input, options);
}

// Export convenience function
if (typeof window !== 'undefined') {
    window.verifyAuthorship = verifyAuthorship;
}
