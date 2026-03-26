# Human Authorship Verifier

## Why Human Authorship Verification?

In an era of AI-generated content flooding the internet, **Human Authorship Verifier** provides cryptographic proof that text was actually typed by a human being. This creates a resistance mechanism against "AI slop" - the endless stream of algorithmically generated content that drowns out human creativity and thought.

**Key Benefits:**
- **Authenticity**: Prove your content is genuinely human-authored
- **Resistance to AI**: Create barriers for AI content farms and spam
- **Trust Building**: Establish verifiable provenance in digital communication
- **Privacy-First**: Anonymous verification without revealing personal data
- **Decentralized**: No central authority - cryptographic verification works offline

## Features

- **Cryptographic Verification**: RSA-PSS signatures with SHA-256 hashing
- **Two-Tier Verification System**: Fast content verification + optional behavioral verification
- **Behavioral Logging**: Keystroke patterns and timing analysis with multiple event types
- **TLV Binary Serialization**: 70%+ space savings for efficient log storage and transmission
- **Anonymous User Fingerprints**: User-defined identifiers hashed for privacy
- **Key Pair Management**: Generate, export, and import cryptographic keys
- **Live HTML Generation**: Real-time output for web publishing
- **Tamper-Proof Verification**: Text hash included in signature for enhanced security
- **Web Verification Interface**: Standalone verification tool
- **Cross-Platform**: Works in browsers and Node.js environments

## Quick Start

1. Open `index.html` in your web browser
2. Generate or import a key pair
3. (Optional) Set your user fingerprint for anonymous identification
4. Type your text - keystrokes are automatically logged
5. Copy the generated HTML output
6. Host the eventlog.json file at a public URL
7. Update the `data-hav-log` attribute to point to your hosted log
8. Publish the HTML on your website

## Components

### Key Pair Management

- **Generate Key Pair**: Creates RSA-PSS key pair (2048-bit modulus, SHA-256 hash)
- **Export Key Pair**: Downloads complete key pair as JSON for backup
- **Import Key Pair**: Restores key pair from backup file
- **Local Storage**: Keys stored securely in browser localStorage

### User Fingerprint System

- **Anonymous Identification**: User-defined identifier (name, DOB, etc.) hashed with SHA-256
- **Cross-Key Consistency**: Same user recognized across different key pairs
- **Privacy Protection**: Personal information is cryptographically hashed
- **Optional**: Users can choose not to set a fingerprint

### Behavioral Logging

While typing, the following events are logged:
- `input`: Complete text state changes (most reliable for reconstruction)
- `insert`: Character insertion at specific cursor position
- `backspace`: Character deletion before cursor
- `delete`: Character deletion at cursor position
- `selection`: Text selection changes
- `keydown`/`keyup`: Key press/release events with timestamps

### Enhanced Security Features

- **Text Hash Verification**: SHA-256 hash of final text included in signed data
- **Timestamp Validation**: Prevents replay attacks with timestamp checking
- **Behavioral Analysis**: Detects suspicious typing patterns
- **Multi-Layer Verification**: Combines cryptographic, behavioral, and temporal checks

### Output Format

The verifiable text is embedded as an HTML element with data attributes:

```html
<p data-hav-key="publickeyjson" data-hav-log="eventlog.json" data-hav-signature="base64signature" data-hav-fingerprint="fingerprint">The authored text here.</p>
```

- `data-hav-key`: JSON string of the author's public key (JWK format)
- `data-hav-log`: URL pointing to the JSON event log file
- `data-hav-signature`: Base64-encoded RSA-PSS signature of the signed data
- `data-hav-fingerprint`: SHA-256 hash of user's anonymous identifier (optional)

### Log File Format

The log is a JSON object containing the event log, text hash, and timestamp:

```json
{
  "log": [
    {"type": "input", "oldValue": "", "newValue": "H", "selectionStart": 1, "selectionEnd": 1, "cursor": 1, "time": 1234567890123},
    {"type": "insert", "char": "e", "cursor": 1, "time": 1234567890150},
    {"type": "backspace", "cursor": 2, "time": 1234567890200}
  ],
  "textHash": "a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3",
  "timestamp": 1234567890123
}
```

**Binary TLV Format**: For efficient storage, logs can be serialized to binary TLV format with 70%+ space savings using `serializeLog()` and `deserializeLog()` functions.

## User Interface

The web application provides an intuitive interface with the following sections:

### 1. Key Management
- **Generate Key Pair**: Creates new RSA-PSS cryptographic keys
- **Export Key Pair**: Downloads complete key pair for backup
- **Import Key Pair**: Restores keys from backup file
- **Clear Stored Keys**: Removes all stored cryptographic material

### 2. User Fingerprint (Optional)
- **Input Field**: Enter personal identifier (name, DOB, nickname, etc.)
- **Update Fingerprint**: Generates SHA-256 hash for anonymous identification
- **Display**: Shows current fingerprint hash
- **Purpose**: Enables cross-key-pair user recognition while maintaining anonymity

### 3. Text Authoring
- **Live Typing**: Real-time keystroke logging
- **Event Tracking**: Captures keydown, keyup, and text diff events
- **Character Count**: Shows typing progress

### 4. Output Generation
- **Live HTML**: Real-time generated verifiable HTML
- **Copy to Clipboard**: Easy copying of output
- **Download Log**: Export event log as JSON file

## Detailed Workflow

1. **Initial Setup**:
   - Open `index.html` in a modern web browser
   - Generate a new key pair or import existing keys

2. **Optional Fingerprint Setup**:
   - Enter a personal identifier (e.g., "John Doe", "johndoe@example.com")
   - Click "Update Fingerprint" to generate anonymous hash
   - This creates a consistent identifier across different key pairs

3. **Content Creation**:
   - Type your text in the input field
   - Keystrokes are automatically logged with timestamps
   - View real-time HTML output generation

4. **Export & Hosting**:
   - Copy the generated HTML output
   - Download the eventlog.txt file
   - Host the log file at a publicly accessible URL

5. **Publishing**:
   - Embed the HTML in your webpage
   - Update `data-hav-log` to point to your hosted log URL
   - The public key and fingerprint are already embedded

6. **Verification**:
   - Others can verify your authorship using the embedded data
   - Fingerprint allows recognition across different key pairs

## Two-Tier Verification System

The system now supports **two levels of verification** for different use cases:

### Level 1: Content Integrity Check (Fast, No Network)
- **Purpose**: Quickly verify that the displayed text hasn't been tampered with
- **Requirements**: Only embedded data (public key, content signature, timestamp)
- **Network**: None required
- **Security**: Cryptographically proves text authenticity
- **Use Case**: Social media posts, quick verification, resource-constrained environments

### Level 2: Full Behavioral Verification (Complete, Requires Network)
- **Purpose**: Verify human authorship with behavioral analysis
- **Requirements**: Log file must be fetched from URL
- **Network**: One HTTP request to fetch log
- **Security**: Proves text was actually typed with human-like behavior
- **Use Case**: High-trust scenarios, academic publishing, legal documents

### Verification Process

**Option A: Traditional Single-Tier (Legacy)**
1. Extract the log URL from `data-hav-log`.
2. Fetch the log file.
3. Extract the public key from `data-hav-key`.
4. Verify the signature using the author's public key.
5. Reconstruct the text from the log events.
6. Compare reconstructed text with displayed text.
7. (Optional) Extract fingerprint from `data-hav-fingerprint` for user identification.

**Option B: Two-Tier Verification**
1. **Level 1**: Verify content signature against displayed text (no network)
2. **Level 2** (Optional): Fetch log and verify behavioral signature
3. Combine results for comprehensive verification

### Two-Tier API Usage

```javascript
const { verifyContent, verifyLogSignature, verifyTwoTier } = require('./hav-core');

// Level 1: Fast content verification
const level1Result = await verifyContent(text, contentSignature, timestamp, publicKey);
if (level1Result.isValid) {
    console.log('✅ Text integrity verified');
}

// Level 2: Full behavioral verification (requires log)
const level2Result = await verifyLogSignature(log, text, logSignature, timestamp, publicKey);
if (level2Result.isValid) {
    console.log('✅ Human authorship verified with behavioral data');
}

// Combined verification
const combinedResult = await verifyTwoTier(text, contentSignature, logSignature, timestamp, publicKey, log);
if (combinedResult.isValid) {
    console.log('✅ Complete verification passed');
}
```

### Fingerprint Verification

The fingerprint allows verification that multiple pieces of content were authored by the same anonymous user:

```javascript
function verifyFingerprint(content1, content2) {
  const fp1 = content1.getAttribute('data-hav-fingerprint');
  const fp2 = content2.getAttribute('data-hav-fingerprint');
  return fp1 && fp2 && fp1 === fp2;
}
```

This enables:
- **Cross-Platform Recognition**: Same user across different devices
- **Key Migration**: User consistency when changing key pairs
- **Account Continuity**: Proving authorship history anonymously

### Reconstruction Algorithm

```javascript
function reconstructText(log) {
  let text = '';
  for (const entry of log) {
    switch (entry.type) {
      case 'input':
        // Use the newValue directly from input events - this is the most reliable
        text = entry.newValue;
        break;
      case 'insert':
        // Insert character at cursor position
        const cursor = entry.cursor || 0;
        if (entry.char && entry.char.length === 1) {
          text = text.slice(0, cursor) + entry.char + text.slice(cursor);
        }
        break;
      case 'backspace':
        // Remove character before cursor (if cursor > 0)
        if (entry.cursor > 0) {
          text = text.slice(0, entry.cursor - 1) + text.slice(entry.cursor);
        }
        break;
      case 'delete':
        // Remove character at cursor (if cursor < text.length)
        if (entry.cursor < text.length) {
          text = text.slice(0, entry.cursor) + text.slice(entry.cursor + 1);
        }
        break;
      // selection, keydown, keyup don't change text content
    }
  }
  return text;
}
```

### Signature Verification

Use RSA-PSS verification with SHA-256 to verify the log content against the signature and public key.

## Security Considerations

### Cryptographic Security
- The private key must remain secret and never be shared
- RSA-PSS with SHA-256 provides strong cryptographic guarantees
- Key pairs are generated using Web Crypto API with secure parameters
- All signatures are cryptographically verifiable

### Fingerprint Privacy
- User identifiers are hashed with SHA-256 before storage or transmission
- Fingerprints enable anonymous user recognition without revealing personal data
- Users have full control over what information to include in their fingerprint
- Fingerprints are optional and can be omitted for maximum privacy

### Content Security
- The log file must be hosted securely to prevent tampering
- Keystroke timing patterns provide additional evidence of human authorship
- Event logs contain behavioral data that is difficult to forge artificially
- This system proves the text was typed by someone with access to the private key

### Verification Trust
- Public keys are embedded in the HTML for immediate verification
- Log files should be hosted on trusted, tamper-resistant infrastructure
- The system assumes honest log hosting for full security guarantees
- Multiple verification methods (signature + fingerprint + behavioral data) provide layered security

## Verification Tools

### Web Verification Interface (`verify.html`)

A standalone web application for verifying human-authored content:

**Features:**
- **Single Verification**: Paste HTML containing authorship data for verification
- **URL Verification**: Enter a URL to fetch and verify remote content
- **Batch Verification**: Verify multiple elements at once
- **Detailed Results**: Comprehensive verification report with errors and warnings
- **Real-time Feedback**: Live verification status and progress indicators

**Usage:**
1. Open `verify.html` in your web browser
2. Choose verification method (single, URL, or batch)
3. Input your content or URL
4. Review the detailed verification results

### Scriptable API (`hav-verify.js`)

A JavaScript library for programmatic verification of human-authored content.

**Installation:**
```html
<script src="hav-verify.js"></script>
```

**Basic Usage:**
```javascript
// Verify a DOM element
const result = await verifyAuthorship(document.getElementById('myElement'));
if (result.isValid) {
    console.log('✓ Authorship verified!');
} else {
    console.log('✗ Verification failed:', result.details.errors);
}

// Verify HTML string
const html = '<p data-hav-key="..." data-hav-log="..." data-hav-signature="...">Hello world</p>';
const result = await verifyAuthorship(html);

// Advanced usage with options
const result = await verifyAuthorship(element, {
    timeout: 10000,
    checkFingerprint: true,
    allowUnsigned: false
});
```

**Class-based API:**
```javascript
const verifier = new HumanAuthorshipVerifier({
    timeout: 15000,
    checkFingerprint: true
});

// Single verification
const result = await verifier.verify(element);

// Batch verification
const results = await verifier.verifyBatch([element1, element2, element3]);
```

**Verification Result Format:**
```javascript
{
    isValid: true,
    details: {
        signatureValid: true,
        textMatches: true,
        logAccessible: true,
        fingerprint: "abc123...",
        reconstructedText: "Hello world",
        errors: [],
        warnings: ["Log timestamp is unusually old"]
    }
}
```

**API Methods:**
- `verify(input, options)`: Verify a single element or HTML string
- `verifyBatch(elements, options)`: Verify multiple elements
- `verifyAuthorship(input, options)`: Convenience function for quick verification

## Core Library API (`hav-core.js`)

The core library provides simple, low-level functions for signing and verification without DOM dependencies.

### Key Generation
```javascript
const { generateKeyPair } = require('./hav-core');

// Generate RSA key pair
const { publicKey, privateKey } = generateKeyPair();
// Returns JWK objects for both keys
```

### Signing Content
```javascript
const { signLog } = require('./hav-core');

// Sign log data with private key
const log = [
  { type: 'input', oldValue: '', newValue: 'H', selectionStart: 1, selectionEnd: 1, cursor: 1, time: Date.now() },
  { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
  { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
  { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
  { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 }
];
const text = "Hello";

const { signature, signedData } = signLog(log, text, privateKey);
// signature: Base64-encoded signature string
// signedData: The exact data that was signed (for verification)
```

### Verifying Content
```javascript
const { verifyLog } = require('./hav-core');

// Verify signed content
const result = verifyLog(log, text, signature, publicKey, signedData);

if (result.isValid) {
  console.log('✅ Content verified!');
  console.log('Reconstructed text:', result.details.reconstructedText);
} else {
  console.log('❌ Verification failed:', result.details.errors);
}
```

### API Reference

#### `generateKeyPair()`
- **Returns**: `{ publicKey, privateKey }` - JWK objects
- **Purpose**: Generate RSA-2048 key pair for signing

#### `signLog(log, text, privateKey)`
- **Parameters**:
  - `log`: Array of log events
  - `text`: The text content string
  - `privateKey`: JWK private key object
- **Returns**: `{ signature, signedData }`
- **Purpose**: Sign log data with private key

#### `verifyLog(log, text, signature, publicKey, signedData?)`
- **Parameters**:
  - `log`: Array of log events
  - `text`: The text content string
  - `signature`: Base64 signature string
  - `publicKey`: JWK public key object
  - `signedData`: Optional exact signed data (for testing)
- **Returns**: Verification result object
- **Purpose**: Verify signed content

#### `reconstructText(log)`
- **Parameters**: `log` - Array of log events
- **Returns**: Reconstructed text string
- **Purpose**: Rebuild text from log events

#### `serializeLog(log)`
- **Parameters**: `log` - Array of log events
- **Returns**: `Uint8Array` - Binary TLV data
- **Purpose**: Serialize log to compact binary format (70%+ space savings)

#### `deserializeLog(data)`
- **Parameters**: `data` - `Uint8Array` binary TLV data
- **Returns**: Array of log events
- **Purpose**: Deserialize binary TLV data back to log array

## Implementation

All HTML pages now use the same core library (`hav-core.js`) for consistent signing and verification:

- **`index.html`** - Authoring interface using `hav-core.js` for key generation and signing
- **`verify.html`** - Verification interface using `hav-core.js` for signature verification
- **`hav-core.js`** - Core library with signing/verification functions (Node.js and browser compatible)
- **`hav-verify.js`** - Browser wrapper library that uses `hav-core.js` internally

All implementations use the Web Crypto API for cryptographic operations.

## Cross-Platform Compatibility

The core library (`hav-core.js`) automatically detects the runtime environment:

- **Browser Environment**: Uses `crypto.subtle` API for Web Crypto operations
- **Node.js Environment**: Uses Node.js `crypto` module for cryptographic operations

This ensures consistent behavior across different JavaScript runtimes while maintaining optimal performance for each platform.

## Limitations

- Requires JavaScript-enabled browser for authoring.
- Assumes honest log hosting.
- Does not prevent screen recording or other input methods.
- Verification requires access to the public key.
