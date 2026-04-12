/**
 * Human Authorship Verifier - Core Verification Library
 * Provides cryptographic verification of human-authored content
 */

// Detect environment
const isBrowser = typeof window !== 'undefined' && typeof window.crypto !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Import core functions to avoid duplication
let verifyLogCore, reconstructTextCore;

if (isNode) {
    ({ verifyLog: verifyLogCore, reconstructText: reconstructTextCore } = require('./hav-core'));
} else if (isBrowser && window.HAVCore) {
    ({ verifyLog: verifyLogCore, reconstructText: reconstructTextCore } = window.HAVCore);
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

            // Get displayed text
            const displayedText = this._getDisplayedText(element);

            // Verify signature
            const verificationResult = await this._verifySignature(logData, data.signature, data.publicKey, displayedText);
            result.details.signatureValid = verificationResult.details.signatureValid;
            result.details.textMatches = verificationResult.details.textMatches;
            result.details.reconstructedText = verificationResult.details.reconstructedText;
            result.details.errors.push(...verificationResult.details.errors);
            result.details.warnings.push(...verificationResult.details.warnings);

            if (!result.details.signatureValid) {
                result.details.errors.push('Invalid signature');
                return result;
            }

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
     * Verify using primitive data (no HTML parsing or fetching)
     * @param {Object} logData - Log data object with log array and timestamp
     * @param {string} text - The text to verify
     * @param {string} signature - Base64 signature
     * @param {Object} publicKey - JWK public key
     * @param {Object} options - Verification options
     * @returns {Promise<Object>} Verification result
     */
    async verifyPrimitives(logData, text, signature, publicKey, options = {}) {
        const opts = { ...this.options, ...options };
        const result = {
            isValid: false,
            details: {
                signatureValid: false,
                textMatches: false,
                logAccessible: true, // provided directly
                fingerprint: null,
                reconstructedText: '',
                errors: [],
                warnings: []
            }
        };

        try {
            // Verify signature
            const signatureValid = await this._verifySignaturePrimitives(logData, signature, publicKey, text);
            result.details.signatureValid = signatureValid;

            if (!signatureValid) {
                result.details.errors.push('Invalid signature');
                return result;
            }

            // Reconstruct text from log
            const reconstructedText = this._reconstructText(logData.log);
            result.details.reconstructedText = reconstructedText;

            // Compare texts
            result.details.textMatches = reconstructedText === text.trim();

            if (!result.details.textMatches) {
                result.details.errors.push('Displayed text does not match log reconstruction');
                return result;
            }

            // Check for additional security features
            this._checkSecurityFeatures(logData, result.details);

            // Final validation
            result.isValid = result.details.signatureValid && result.details.textMatches;

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
        const sigAttr = element.getAttribute('data-hav-signature'); // Legacy
        const logSigAttr = element.getAttribute('data-hav-log-signature'); // Two-tier
        const contentSigAttr = element.getAttribute('data-hav-content-signature'); // Two-tier
        const timestampAttr = element.getAttribute('data-hav-timestamp');
        const fpAttr = element.getAttribute('data-hav-fingerprint');

        // Use log signature if available (two-tier), otherwise fall back to legacy signature
        const signature = logSigAttr || sigAttr;

        if (!keyAttr || !signature) {
            console.warn('Missing required authorship attributes:', {
                hasKey: !!keyAttr,
                hasLogSignature: !!logSigAttr,
                hasLegacySignature: !!sigAttr,
                hasContentSignature: !!contentSigAttr,
                hasTimestamp: !!timestampAttr
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
                signature: signature,
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
    async _verifySignature(logData, signature, publicKeyJwk, text) {
        try {
            // Use core verification function
            const result = await verifyLogCore(logData.log, text, signature, publicKeyJwk, logData);
            return result;
        } catch (error) {
            console.error('Signature verification error:', error);
            return {
                isValid: false,
                details: {
                    signatureValid: false,
                    textMatches: false,
                    reconstructedText: '',
                    errors: [`Verification error: ${error.message}`],
                    warnings: []
                }
            };
        }
    }

    /**
     * Verify cryptographic signature using primitives
     * @private
     */
    async _verifySignaturePrimitives(logData, signature, publicKeyJwk, text) {
        try {
            // Use core verification function
            const result = await verifyLogCore(logData.log, text, signature, publicKeyJwk, logData);
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
            // Use core text reconstruction
            return reconstructTextCore(log);
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
        let text = '';

        // For text elements, get text content
        if (element.textContent) {
            text = element.textContent;
        }

        // For input/textarea elements
        if (element.value) {
            text = element.value;
        }

        // Normalize whitespace to handle line breaks and multiple spaces consistently
        // This ensures HTML whitespace (including line breaks) matches textarea input
        return this._normalizeWhitespace(text);
    }

    /**
     * Normalize whitespace for consistent comparison
     * @private
     */
    _normalizeWhitespace(text) {
        return text
            // Replace all whitespace (including newlines, tabs, multiple spaces) with single spaces
            .replace(/\s+/g, ' ')
            // Trim leading/trailing whitespace
            .trim();
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
