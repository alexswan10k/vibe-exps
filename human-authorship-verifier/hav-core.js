/**
 * Human Authorship Verifier - Core Library
 * Contains signing and verification functions for human-authored content
 */

// Initialize global namespace immediately
if (typeof window !== 'undefined') {
    window.HAVCore = {};
}

// Detect environment
const isBrowser = typeof window !== 'undefined' && typeof window.crypto !== 'undefined';
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Browser implementation using Web Crypto API
async function browserGenerateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-PSS',
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: 'SHA-256',
        },
        true,
        ['sign', 'verify']
    );

    // Export keys to JWK format
    const publicKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return {
        publicKey: publicKeyJwk,
        privateKey: privateKeyJwk
    };
}

async function browserGenerateTextHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function browserSignLog(log, text, privateKeyJwk) {
    const timestamp = Date.now();
    const textHash = await browserGenerateTextHash(text);

    // Import private key
    const privateKey = await crypto.subtle.importKey(
        'jwk',
        privateKeyJwk,
        {
            name: 'RSA-PSS',
            hash: 'SHA-256',
        },
        false,
        ['sign']
    );

    // Sign content (text + timestamp)
    const contentSignedData = {
        text: text,
        timestamp: timestamp
    };
    const contentEncoder = new TextEncoder();
    const contentDataBuffer = contentEncoder.encode(JSON.stringify(contentSignedData));
    const contentSignature = await crypto.subtle.sign(
        {
            name: 'RSA-PSS',
            saltLength: 32, // 256 bits for SHA-256
        },
        privateKey,
        contentDataBuffer
    );
    const contentSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(contentSignature)));

    // Sign log (log + textHash + timestamp)
    const logSignedData = {
        log: log,
        textHash: textHash,
        timestamp: timestamp
    };
    const logEncoder = new TextEncoder();
    const logDataBuffer = logEncoder.encode(JSON.stringify(logSignedData));
    const logSignature = await crypto.subtle.sign(
        {
            name: 'RSA-PSS',
            saltLength: 32, // 256 bits for SHA-256
        },
        privateKey,
        logDataBuffer
    );
    const logSignatureBase64 = btoa(String.fromCharCode(...new Uint8Array(logSignature)));

    return {
        contentSignature: contentSignatureBase64,
        logSignature: logSignatureBase64,
        timestamp: timestamp,
        // Legacy support
        signature: logSignatureBase64,
        signedData: logSignedData
    };
}

async function browserVerifyLog(log, text, signature, publicKeyJwk, signedData = null) {
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

        // Normalize both texts for consistent comparison (handle HTML whitespace)
        const normalizedDisplayed = text.trim().replace(/\s+/g, ' ').trim();
        const normalizedReconstructed = reconstructedText.replace(/\s+/g, ' ').trim();

        // Compare texts
        result.details.textMatches = normalizedReconstructed === normalizedDisplayed;

        if (!result.details.textMatches) {
            result.details.errors.push('Displayed text does not match log reconstruction');
            return result;
        }

        // Import public key
        const publicKey = await crypto.subtle.importKey(
            'jwk',
            publicKeyJwk,
            {
                name: 'RSA-PSS',
                hash: 'SHA-256',
            },
            false,
            ['verify']
        );

        let signatureValid = false;
        let verifiedTimestamp = null;

        // If signedData is provided (for testing), use it directly
        if (signedData) {
            try {
                const encoder = new TextEncoder();
                const dataBuffer = encoder.encode(JSON.stringify(signedData));
                const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

                signatureValid = await crypto.subtle.verify(
                    {
                        name: 'RSA-PSS',
                        saltLength: 32, // 256 bits for SHA-256
                    },
                    publicKey,
                    signatureBuffer,
                    dataBuffer
                );
                verifiedTimestamp = signedData.timestamp;
            } catch (error) {
                console.error('Direct verification failed:', error);
            }
        } else {
            // For cases where signedData is not provided (testing), use timestamp guessing
            const now = Date.now();
            const textHash = await browserGenerateTextHash(text);

            // Check a wider range of timestamps (within last 24 hours)
            for (let i = 0; i < 24 * 60 * 60 * 1000; i += 1000) { // Check every second for 24 hours
                const testTimestamp = now - i;
                const testSignedData = {
                    log: log,
                    textHash: textHash,
                    timestamp: testTimestamp
                };

                try {
                    const encoder = new TextEncoder();
                    const dataBuffer = encoder.encode(JSON.stringify(testSignedData));
                    const signatureBuffer = Uint8Array.from(atob(signature), c => c.charCodeAt(0));

                    if (await crypto.subtle.verify(
                        {
                            name: 'RSA-PSS',
                            saltLength: 32, // 256 bits for SHA-256
                        },
                        publicKey,
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
            }
        }

        result.details.signatureValid = signatureValid;

        if (!signatureValid) {
            result.details.errors.push('Invalid signature');
            return result;
        }

        // Verify text hash matches
        const expectedHash = await browserGenerateTextHash(text);
        const actualHash = await browserGenerateTextHash(reconstructedText);
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

// Node.js implementation using Node.js crypto module
function nodeGenerateKeyPair() {
    const crypto = require('crypto');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // Convert to JWK format
    const publicKeyObject = crypto.createPublicKey(publicKey);
    const privateKeyObject = crypto.createPrivateKey(privateKey);

    return {
        publicKey: publicKeyObject.export({ format: 'jwk' }),
        privateKey: privateKeyObject.export({ format: 'jwk' })
    };
}

function nodeGenerateTextHash(text) {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(text.trim(), 'utf8').digest('hex');
}

function nodeSignLog(log, text, privateKeyJwk) {
    const crypto = require('crypto');
    const timestamp = Date.now();
    const textHash = nodeGenerateTextHash(text);

    // Import private key
    const privateKeyObject = crypto.createPrivateKey({
        key: privateKeyJwk,
        format: 'jwk'
    });

    // Sign content (text + timestamp)
    const contentSignedData = {
        text: text,
        timestamp: timestamp
    };
    const contentSign = crypto.createSign('RSA-SHA256');
    contentSign.update(JSON.stringify(contentSignedData));
    const contentSignature = contentSign.sign(privateKeyObject, 'base64');

    // Sign log (log + textHash + timestamp)
    const logSignedData = {
        log: log,
        textHash: textHash,
        timestamp: timestamp
    };
    const logSign = crypto.createSign('RSA-SHA256');
    logSign.update(JSON.stringify(logSignedData));
    const logSignature = logSign.sign(privateKeyObject, 'base64');

    return {
        contentSignature,
        logSignature,
        timestamp,
        // Legacy support
        signature: logSignature,
        signedData: logSignedData
    };
}

function nodeVerifyLog(log, text, signature, publicKeyJwk, signedData = null) {
    const crypto = require('crypto');

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

        // Normalize both texts for consistent comparison (handle HTML whitespace)
        const normalizedDisplayed = text.trim().replace(/\s+/g, ' ').trim();
        const normalizedReconstructed = reconstructedText.replace(/\s+/g, ' ').trim();

        // Compare texts
        result.details.textMatches = normalizedReconstructed === normalizedDisplayed;

        if (!result.details.textMatches) {
            result.details.errors.push('Displayed text does not match log reconstruction');
            return result;
        }

        // Import public key
        const publicKeyObject = crypto.createPublicKey({
            key: publicKeyJwk,
            format: 'jwk'
        });

        let signatureValid = false;
        let verifiedTimestamp = null;

        // If signedData is provided (for testing), use it directly
        if (signedData) {
            try {
                const verify = crypto.createVerify('RSA-SHA256');
                verify.update(JSON.stringify(signedData));
                const signatureBuffer = Buffer.from(signature, 'base64');

                signatureValid = verify.verify(publicKeyObject, signatureBuffer);
                verifiedTimestamp = signedData.timestamp;
            } catch (error) {
                console.error('Direct verification failed:', error);
            }
        } else {
            // For cases where signedData is not provided (testing), use timestamp guessing
            const now = Date.now();
            const textHash = nodeGenerateTextHash(text);

            // Check a wider range of timestamps (within last 24 hours)
            for (let i = 0; i < 24 * 60 * 60 * 1000; i += 1000) { // Check every second for 24 hours
                const testTimestamp = now - i;
                const testSignedData = {
                    log: log,
                    textHash: textHash,
                    timestamp: testTimestamp
                };

                try {
                    const verify = crypto.createVerify('RSA-SHA256');
                    verify.update(JSON.stringify(testSignedData));
                    const signatureBuffer = Buffer.from(signature, 'base64');

                    if (verify.verify(publicKeyObject, signatureBuffer)) {
                        signatureValid = true;
                        verifiedTimestamp = testTimestamp;
                        break;
                    }
                } catch (e) {
                    // Continue trying different timestamps
                }
            }
        }

        result.details.signatureValid = signatureValid;

        if (!signatureValid) {
            result.details.errors.push('Invalid signature');
            return result;
        }

        // Verify text hash matches
        const expectedHash = nodeGenerateTextHash(text);
        const actualHash = nodeGenerateTextHash(reconstructedText);
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

// Unified API that works in both environments
function generateKeyPair() {
    if (isBrowser) {
        return browserGenerateKeyPair();
    } else if (isNode) {
        return nodeGenerateKeyPair();
    } else {
        throw new Error('Unsupported environment');
    }
}

function generateTextHash(text) {
    if (isBrowser) {
        return browserGenerateTextHash(text);
    } else if (isNode) {
        return nodeGenerateTextHash(text);
    } else {
        throw new Error('Unsupported environment');
    }
}

function signLog(log, text, privateKey) {
    if (isBrowser) {
        return browserSignLog(log, text, privateKey);
    } else if (isNode) {
        return nodeSignLog(log, text, privateKey);
    } else {
        throw new Error('Unsupported environment');
    }
}

function verifyLog(log, text, signature, publicKey, signedData = null) {
    if (isBrowser) {
        return browserVerifyLog(log, text, signature, publicKey, signedData);
    } else if (isNode) {
        return nodeVerifyLog(log, text, signature, publicKey, signedData);
    } else {
        throw new Error('Unsupported environment');
    }
}

/**
 * Reconstruct text from event log
 * @param {Array} log - Array of log events
 * @returns {string} Reconstructed text
 */
function reconstructText(log) {
    let text = '';

    for (const entry of log) {
        if (entry.type === 'diff' && entry.change) {
            const pos = entry.change.pos || 0;

            // Handle removal first, then addition
            if (entry.change.removed) {
                const removeLength = entry.change.removed.length;
                text = text.slice(0, pos) + text.slice(pos + removeLength);
            }

            if (entry.change.added) {
                text = text.slice(0, pos) + entry.change.added + text.slice(pos);
            }
        }
    }

    return text;
}

/**
 * Check additional security features
 * @param {Object} logData - Log data object
 * @param {Object} details - Result details object
 */
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

/**
 * Calculate average interval between events
 * @param {Array} events - Array of events with timestamps
 * @returns {number} Average interval in milliseconds
 */
function calculateAverageInterval(events) {
    if (events.length < 2) return 0;

    const intervals = [];
    for (let i = 1; i < events.length; i++) {
        intervals.push(events[i].time - events[i-1].time);
    }

    return intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
}

/**
 * Verify content signature (Level 1: Text integrity check)
 * @param {string} text - The text content to verify
 * @param {string} contentSignature - Base64 content signature
 * @param {number} timestamp - Timestamp when signed
 * @param {Object} publicKey - JWK public key
 * @returns {Promise<Object>} Verification result
 */
async function verifyContent(text, contentSignature, timestamp, publicKey) {
    const result = {
        isValid: false,
        details: {
            contentSignatureValid: false,
            textMatches: false,
            errors: [],
            warnings: []
        }
    };

    try {
        // Check timestamp is reasonable
        const now = Date.now();
        if (Math.abs(now - timestamp) > 365 * 24 * 60 * 60 * 1000) { // 1 year
            result.details.warnings.push('Content timestamp is unusually old or in the future');
        }

        // Verify content signature
        const signedData = { text, timestamp };

        if (isBrowser) {
            const publicKeyObj = await crypto.subtle.importKey(
                'jwk',
                publicKey,
                { name: 'RSA-PSS', hash: 'SHA-256' },
                false,
                ['verify']
            );

            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(signedData));
            const signatureBuffer = Uint8Array.from(atob(contentSignature), c => c.charCodeAt(0));

            result.details.contentSignatureValid = await crypto.subtle.verify(
                { name: 'RSA-PSS', saltLength: 32 },
                publicKeyObj,
                signatureBuffer,
                dataBuffer
            );
        } else if (isNode) {
            const crypto = require('crypto');
            const publicKeyObj = crypto.createPublicKey({ key: publicKey, format: 'jwk' });
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(JSON.stringify(signedData));
            result.details.contentSignatureValid = verify.verify(publicKeyObj, Buffer.from(contentSignature, 'base64'));
        }

        if (!result.details.contentSignatureValid) {
            result.details.errors.push('Invalid content signature');
            return result;
        }

        result.details.textMatches = true; // Content signature proves text integrity
        result.isValid = true;

    } catch (error) {
        result.details.errors.push(`Content verification error: ${error.message}`);
    }

    return result;
}

/**
 * Verify log signature (Level 2: Behavioral verification)
 * @param {Array} log - Event log array
 * @param {string} text - The text content
 * @param {string} logSignature - Base64 log signature
 * @param {number} timestamp - Timestamp when signed
 * @param {Object} publicKey - JWK public key
 * @returns {Promise<Object>} Verification result
 */
async function verifyLogSignature(log, text, logSignature, timestamp, publicKey) {
    const result = {
        isValid: false,
        details: {
            logSignatureValid: false,
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

        // Normalize texts for comparison
        const normalizedDisplayed = text.trim().replace(/\s+/g, ' ').trim();
        const normalizedReconstructed = reconstructedText.replace(/\s+/g, ' ').trim();
        result.details.textMatches = normalizedDisplayed === normalizedReconstructed;

        if (!result.details.textMatches) {
            result.details.errors.push('Displayed text does not match log reconstruction');
            return result;
        }

        // Generate expected text hash
        const expectedHash = isBrowser ? await browserGenerateTextHash(text) : nodeGenerateTextHash(text);
        const actualHash = isBrowser ? await browserGenerateTextHash(reconstructedText) : nodeGenerateTextHash(reconstructedText);
        result.details.textHashValid = expectedHash === actualHash;

        if (!result.details.textHashValid) {
            result.details.errors.push('Text hash mismatch');
            return result;
        }

        // Verify log signature
        const signedData = { log, textHash: expectedHash, timestamp };

        if (isBrowser) {
            const publicKeyObj = await crypto.subtle.importKey(
                'jwk',
                publicKey,
                { name: 'RSA-PSS', hash: 'SHA-256' },
                false,
                ['verify']
            );

            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(signedData));
            const signatureBuffer = Uint8Array.from(atob(logSignature), c => c.charCodeAt(0));

            result.details.logSignatureValid = await crypto.subtle.verify(
                { name: 'RSA-PSS', saltLength: 32 },
                publicKeyObj,
                signatureBuffer,
                dataBuffer
            );
        } else if (isNode) {
            const crypto = require('crypto');
            const publicKeyObj = crypto.createPublicKey({ key: publicKey, format: 'jwk' });
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(JSON.stringify(signedData));
            result.details.logSignatureValid = verify.verify(publicKeyObj, Buffer.from(logSignature, 'base64'));
        }

        if (!result.details.logSignatureValid) {
            result.details.errors.push('Invalid log signature');
            return result;
        }

        // Check security features
        checkSecurityFeatures({ log, textHash: expectedHash, timestamp }, result.details);

        result.isValid = result.details.logSignatureValid && result.details.textMatches && result.details.textHashValid;

    } catch (error) {
        result.details.errors.push(`Log verification error: ${error.message}`);
    }

    return result;
}

/**
 * Two-tier verification: Content + Log
 * @param {string} text - The text content
 * @param {string} contentSignature - Base64 content signature
 * @param {string} logSignature - Base64 log signature
 * @param {number} timestamp - Timestamp when signed
 * @param {Object} publicKey - JWK public key
 * @param {Array} log - Event log array (fetched from URL)
 * @returns {Promise<Object>} Combined verification result
 */
async function verifyTwoTier(text, contentSignature, logSignature, timestamp, publicKey, log) {
    const result = {
        level1Valid: false,
        level2Valid: false,
        isValid: false,
        details: {
            contentVerification: null,
            logVerification: null,
            errors: [],
            warnings: []
        }
    };

    // Level 1: Verify content signature
    result.details.contentVerification = await verifyContent(text, contentSignature, timestamp, publicKey);
    result.level1Valid = result.details.contentVerification.isValid;

    if (!result.level1Valid) {
        result.details.errors.push('Level 1 verification failed');
        return result;
    }

    // Level 2: Verify log signature
    result.details.logVerification = await verifyLogSignature(log, text, logSignature, timestamp, publicKey);
    result.level2Valid = result.details.logVerification.isValid;

    // Combine results
    result.isValid = result.level1Valid && result.level2Valid;

    // Merge warnings and errors
    if (result.details.logVerification.details.warnings) {
        result.details.warnings.push(...result.details.logVerification.details.warnings);
    }
    if (!result.level2Valid && result.details.logVerification.details.errors) {
        result.details.errors.push(...result.details.logVerification.details.errors);
    }

    return result;
}

// Export functions for Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateKeyPair,
        generateTextHash,
        signLog,
        verifyLog,
        verifyContent,
        verifyLogSignature,
        verifyTwoTier,
        reconstructText
    };
}

// For browser compatibility - assign functions to global namespace
if (typeof window !== 'undefined') {
    window.HAVCore.generateKeyPair = generateKeyPair;
    window.HAVCore.generateTextHash = generateTextHash;
    window.HAVCore.signLog = signLog;
    window.HAVCore.verifyLog = verifyLog;
    window.HAVCore.verifyContent = verifyContent;
    window.HAVCore.verifyLogSignature = verifyLogSignature;
    window.HAVCore.verifyTwoTier = verifyTwoTier;
    window.HAVCore.reconstructText = reconstructText;
}
