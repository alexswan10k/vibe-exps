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
 * @param {Array} log - Array of log events (input, selection, or simplified keyboard format)
 * @returns {string} Reconstructed text
 */
function reconstructText(log) {
    let text = '';

    for (const entry of log) {
        switch (entry.type) {
            case 'input':
                // Use the newValue directly from input events - this is the most reliable
                text = entry.newValue;
                break;

            case 'insert':
                // Legacy support: Insert character at cursor position
                const cursor = entry.cursor || 0;
                if (entry.char && entry.char.length === 1) {
                    text = text.slice(0, cursor) + entry.char + text.slice(cursor);
                }
                break;

            case 'backspace':
                // Legacy support: Remove character before cursor (if cursor > 0)
                if (entry.cursor > 0) {
                    text = text.slice(0, entry.cursor - 1) + text.slice(entry.cursor);
                }
                break;

            case 'delete':
                // Legacy support: Remove character at cursor (if cursor < text.length)
                if (entry.cursor < text.length) {
                    text = text.slice(0, entry.cursor) + text.slice(entry.cursor + 1);
                }
                break;

            // Selection events don't change text, just cursor/selection state
            case 'selection':
            case 'keydown':
            case 'keyup':
                // These events don't change the text content
                break;
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

/**
 * TLV Type codes for log events
 */
const TLV_TYPES = {
    INPUT: 1,
    INSERT: 2,
    BACKSPACE: 3,
    DELETE: 4,
    SELECTION: 5,
    KEYDOWN: 6,
    KEYUP: 7
};

/**
 * Serialize a log array to TLV binary format
 * @param {Array} log - Array of log events
 * @returns {Uint8Array} Binary TLV data
 */
function serializeLog(log) {
    const buffers = [];

    for (const event of log) {
        const eventBuffer = serializeEvent(event);
        buffers.push(eventBuffer);
    }

    // Concatenate all event buffers
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }

    return result;
}

/**
 * Serialize a single event to TLV format
 * @param {Object} event - Log event object
 * @returns {Uint8Array} TLV binary data for the event
 */
function serializeEvent(event) {
    const type = TLV_TYPES[event.type.toUpperCase()];
    if (type === undefined) {
        throw new Error(`Unknown event type: ${event.type}`);
    }

    let valueBuffer;
    switch (event.type) {
        case 'input':
            valueBuffer = serializeInputEvent(event);
            break;
        case 'insert':
            valueBuffer = serializeInsertEvent(event);
            break;
        case 'backspace':
            valueBuffer = serializeBackspaceEvent(event);
            break;
        case 'delete':
            valueBuffer = serializeDeleteEvent(event);
            break;
        case 'selection':
            valueBuffer = serializeSelectionEvent(event);
            break;
        case 'keydown':
            valueBuffer = serializeKeyEvent(event);
            break;
        case 'keyup':
            valueBuffer = serializeKeyEvent(event);
            break;
        default:
            throw new Error(`Unsupported event type: ${event.type}`);
    }

    // Create TLV: Type (1 byte) + Length (2 bytes) + Value
    const length = valueBuffer.length;
    const tlvBuffer = new Uint8Array(3 + length);
    tlvBuffer[0] = type;
    // Big-endian length
    tlvBuffer[1] = (length >> 8) & 0xFF;
    tlvBuffer[2] = length & 0xFF;
    tlvBuffer.set(valueBuffer, 3);

    return tlvBuffer;
}

/**
 * Serialize input event fields
 * @param {Object} event
 * @returns {Uint8Array}
 */
function serializeInputEvent(event) {
    const buffers = [];

    // oldValue: string
    buffers.push(serializeString(event.oldValue || ''));

    // newValue: string
    buffers.push(serializeString(event.newValue || ''));

    // selectionStart: uint32
    buffers.push(serializeUint32(event.selectionStart || 0));

    // selectionEnd: uint32
    buffers.push(serializeUint32(event.selectionEnd || 0));

    // cursor: uint32
    buffers.push(serializeUint32(event.cursor || 0));

    // time: uint64
    buffers.push(serializeUint64(event.time || 0));

    return concatenateBuffers(buffers);
}

/**
 * Serialize insert event fields
 * @param {Object} event
 * @returns {Uint8Array}
 */
function serializeInsertEvent(event) {
    const buffers = [];

    // char: string (1 char)
    buffers.push(serializeString(event.char || ''));

    // cursor: uint32
    buffers.push(serializeUint32(event.cursor || 0));

    // time: uint64
    buffers.push(serializeUint64(event.time || 0));

    return concatenateBuffers(buffers);
}

/**
 * Serialize backspace event fields
 * @param {Object} event
 * @returns {Uint8Array}
 */
function serializeBackspaceEvent(event) {
    const buffers = [];

    // cursor: uint32
    buffers.push(serializeUint32(event.cursor || 0));

    // time: uint64
    buffers.push(serializeUint64(event.time || 0));

    return concatenateBuffers(buffers);
}

/**
 * Serialize delete event fields
 * @param {Object} event
 * @returns {Uint8Array}
 */
function serializeDeleteEvent(event) {
    const buffers = [];

    // cursor: uint32
    buffers.push(serializeUint32(event.cursor || 0));

    // time: uint64
    buffers.push(serializeUint64(event.time || 0));

    return concatenateBuffers(buffers);
}

/**
 * Serialize selection event fields
 * @param {Object} event
 * @returns {Uint8Array}
 */
function serializeSelectionEvent(event) {
    const buffers = [];

    // cursor: uint32
    buffers.push(serializeUint32(event.cursor || 0));

    // selectionStart: uint32
    buffers.push(serializeUint32(event.selectionStart || 0));

    // selectionEnd: uint32
    buffers.push(serializeUint32(event.selectionEnd || 0));

    // time: uint64
    buffers.push(serializeUint64(event.time || 0));

    return concatenateBuffers(buffers);
}

/**
 * Serialize keydown/keyup event fields
 * @param {Object} event
 * @returns {Uint8Array}
 */
function serializeKeyEvent(event) {
    const buffers = [];

    // key: string
    buffers.push(serializeString(event.key || ''));

    // time: uint64
    buffers.push(serializeUint64(event.time || 0));

    return concatenateBuffers(buffers);
}

/**
 * Serialize a string as length-prefixed UTF-8
 * @param {string} str
 * @returns {Uint8Array}
 */
function serializeString(str) {
    const encoder = new TextEncoder();
    const strBuffer = encoder.encode(str);
    const length = strBuffer.length;
    const buffer = new Uint8Array(2 + length);
    // Big-endian length
    buffer[0] = (length >> 8) & 0xFF;
    buffer[1] = length & 0xFF;
    buffer.set(strBuffer, 2);
    return buffer;
}

/**
 * Serialize a 32-bit unsigned integer (big-endian)
 * @param {number} value
 * @returns {Uint8Array}
 */
function serializeUint32(value) {
    const buffer = new Uint8Array(4);
    buffer[0] = (value >>> 24) & 0xFF;
    buffer[1] = (value >>> 16) & 0xFF;
    buffer[2] = (value >>> 8) & 0xFF;
    buffer[3] = value & 0xFF;
    return buffer;
}

/**
 * Serialize a 64-bit unsigned integer (big-endian)
 * @param {number} value
 * @returns {Uint8Array}
 */
function serializeUint64(value) {
    const buffer = new Uint8Array(8);
    const high = Math.floor(value / 0x100000000);
    const low = value % 0x100000000;
    buffer[0] = (high >>> 24) & 0xFF;
    buffer[1] = (high >>> 16) & 0xFF;
    buffer[2] = (high >>> 8) & 0xFF;
    buffer[3] = high & 0xFF;
    buffer[4] = (low >>> 24) & 0xFF;
    buffer[5] = (low >>> 16) & 0xFF;
    buffer[6] = (low >>> 8) & 0xFF;
    buffer[7] = low & 0xFF;
    return buffer;
}

/**
 * Concatenate multiple Uint8Arrays
 * @param {Array<Uint8Array>} buffers
 * @returns {Uint8Array}
 */
function concatenateBuffers(buffers) {
    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of buffers) {
        result.set(buf, offset);
        offset += buf.length;
    }
    return result;
}

/**
 * Deserialize TLV binary data back to log array
 * @param {Uint8Array} data - Binary TLV data
 * @returns {Array} Array of log events
 */
function deserializeLog(data) {
    const log = [];
    let offset = 0;

    while (offset < data.length) {
        const event = deserializeEvent(data, offset);
        log.push(event.event);
        offset = event.newOffset;
    }

    return log;
}

/**
 * Deserialize a single TLV event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object} { event, newOffset }
 */
function deserializeEvent(data, offset) {
    const type = data[offset];
    const length = (data[offset + 1] << 8) | data[offset + 2];
    const valueStart = offset + 3;
    const valueEnd = valueStart + length;

    let event;
    let valueOffset = valueStart;

    switch (type) {
        case TLV_TYPES.INPUT:
            event = deserializeInputEvent(data, valueOffset);
            break;
        case TLV_TYPES.INSERT:
            event = deserializeInsertEvent(data, valueOffset);
            break;
        case TLV_TYPES.BACKSPACE:
            event = deserializeBackspaceEvent(data, valueOffset);
            break;
        case TLV_TYPES.DELETE:
            event = deserializeDeleteEvent(data, valueOffset);
            break;
        case TLV_TYPES.SELECTION:
            event = deserializeSelectionEvent(data, valueOffset);
            break;
        case TLV_TYPES.KEYDOWN:
            event = Object.assign(deserializeKeyEvent(data, valueOffset), { type: 'keydown' });
            break;
        case TLV_TYPES.KEYUP:
            event = Object.assign(deserializeKeyEvent(data, valueOffset), { type: 'keyup' });
            break;
        default:
            throw new Error(`Unknown TLV type: ${type}`);
    }

    return { event, newOffset: valueEnd };
}

/**
 * Deserialize input event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object}
 */
function deserializeInputEvent(data, offset) {
    let currentOffset = offset;

    // oldValue
    const oldValueResult = deserializeString(data, currentOffset);
    currentOffset = oldValueResult.newOffset;

    // newValue
    const newValueResult = deserializeString(data, currentOffset);
    currentOffset = newValueResult.newOffset;

    // selectionStart
    const selectionStart = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // selectionEnd
    const selectionEnd = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // cursor
    const cursor = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // time
    const time = deserializeUint64(data, currentOffset);

    return {
        type: 'input',
        oldValue: oldValueResult.value,
        newValue: newValueResult.value,
        selectionStart,
        selectionEnd,
        cursor,
        time
    };
}

/**
 * Deserialize insert event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object}
 */
function deserializeInsertEvent(data, offset) {
    let currentOffset = offset;

    // char
    const charResult = deserializeString(data, currentOffset);
    currentOffset = charResult.newOffset;

    // cursor
    const cursor = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // time
    const time = deserializeUint64(data, currentOffset);

    return {
        type: 'insert',
        char: charResult.value,
        cursor,
        time
    };
}

/**
 * Deserialize backspace event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object}
 */
function deserializeBackspaceEvent(data, offset) {
    let currentOffset = offset;

    // cursor
    const cursor = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // time
    const time = deserializeUint64(data, currentOffset);

    return {
        type: 'backspace',
        cursor,
        time
    };
}

/**
 * Deserialize delete event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object}
 */
function deserializeDeleteEvent(data, offset) {
    let currentOffset = offset;

    // cursor
    const cursor = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // time
    const time = deserializeUint64(data, currentOffset);

    return {
        type: 'delete',
        cursor,
        time
    };
}

/**
 * Deserialize selection event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object}
 */
function deserializeSelectionEvent(data, offset) {
    let currentOffset = offset;

    // cursor
    const cursor = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // selectionStart
    const selectionStart = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // selectionEnd
    const selectionEnd = deserializeUint32(data, currentOffset);
    currentOffset += 4;

    // time
    const time = deserializeUint64(data, currentOffset);

    return {
        type: 'selection',
        cursor,
        selectionStart,
        selectionEnd,
        time
    };
}

/**
 * Deserialize key event
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object}
 */
function deserializeKeyEvent(data, offset) {
    let currentOffset = offset;

    // key
    const keyResult = deserializeString(data, currentOffset);
    currentOffset = keyResult.newOffset;

    // time
    const time = deserializeUint64(data, currentOffset);

    return {
        key: keyResult.value,
        time
    };
}

/**
 * Deserialize a length-prefixed string
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {Object} { value, newOffset }
 */
function deserializeString(data, offset) {
    const length = (data[offset] << 8) | data[offset + 1];
    const strStart = offset + 2;
    const strEnd = strStart + length;
    const decoder = new TextDecoder();
    const value = decoder.decode(data.slice(strStart, strEnd));
    return { value, newOffset: strEnd };
}

/**
 * Deserialize a 32-bit unsigned integer (big-endian)
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {number}
 */
function deserializeUint32(data, offset) {
    return (data[offset] << 24) | (data[offset + 1] << 16) | (data[offset + 2] << 8) | data[offset + 3];
}

/**
 * Deserialize a 64-bit unsigned integer (big-endian)
 * @param {Uint8Array} data
 * @param {number} offset
 * @returns {number}
 */
function deserializeUint64(data, offset) {
    const high = deserializeUint32(data, offset);
    const low = deserializeUint32(data, offset + 4);
    return high * 0x100000000 + low;
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
        reconstructText,
        serializeLog,
        deserializeLog
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
    window.HAVCore.serializeLog = serializeLog;
    window.HAVCore.deserializeLog = deserializeLog;
}
