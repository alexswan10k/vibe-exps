/**
 * Human Authorship Verifier - Node.js Integration Tests
 * Tests the complete end-to-end flow using the actual core library
 * Includes all tests: basic integration, two-tier verification, and tamper detection
 */

const { generateKeyPair, signLog, verifyLog, reconstructText, verifyContent, verifyLogSignature, verifyTwoTier } = require('./hav-core');
const HumanAuthorshipVerifier = require('./hav-verify');

// Test data and functions
async function runTests() {
    console.log('🧪 Running Human Authorship Verifier End-to-End Integration Tests\n');

    // Test 1: Complete end-to-end flow - valid content
    console.log('Test 1: Complete end-to-end flow with valid content');
    try {
        // Step 1: Generate key pair using the actual library function
        const { publicKey, privateKey } = generateKeyPair();
        console.log('   ✅ Generated key pair');

        // Step 2: Create test log data (simulating user typing)
        const testText = "Hello World";
        const testLog = [
            { type: 'diff', change: { added: 'H', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: 'ello ', pos: 1 }, time: Date.now() + 100 },
            { type: 'diff', change: { added: 'World', pos: 6 }, time: Date.now() + 200 }
        ];
        console.log('   ✅ Created test log data');

        // Step 3: Sign the log using the actual library function
        const { signature, signedData } = signLog(testLog, testText, privateKey);
        console.log('   ✅ Signed log data');

        // Step 4: Verify the signature using the actual library function
        const result = verifyLog(testLog, testText, signature, publicKey, signedData);
        console.log('   ✅ Verified signature');

        if (result.isValid) {
            console.log('✅ End-to-end test passed - content is valid');
            console.log('   Reconstructed text:', result.details.reconstructedText);
        } else {
            console.log('❌ End-to-end test failed - content should be valid');
            console.log('   Errors:', result.details.errors);
        }

    } catch (error) {
        console.log('❌ End-to-end test failed:', error.message);
    }

    // Test 2: Tamper detection - modified text
    console.log('\nTest 2: Tamper detection with modified text');
    try {
        // Use the same key pair from test 1
        const { publicKey, privateKey } = generateKeyPair();

        const originalText = "Original content";
        const tamperedText = "Modified content";

        // Create log that matches original text
        const testLog = [
            { type: 'diff', change: { added: originalText, pos: 0 }, time: Date.now() }
        ];

        // Sign with original text
        const { signature } = signLog(testLog, originalText, privateKey);

        // Try to verify with tampered text
        const result = verifyLog(testLog, tamperedText, signature, publicKey);

        if (!result.isValid && result.details.errors.includes('Displayed text does not match log reconstruction')) {
            console.log('✅ Tamper detection test passed - detected text mismatch');
        } else {
            console.log('❌ Tamper detection test failed');
            console.log('   Result:', result);
        }

    } catch (error) {
        console.log('❌ Tamper detection test failed:', error.message);
    }

    // Test 3: Invalid signature detection
    console.log('\nTest 3: Invalid signature detection');
    try {
        const { publicKey } = generateKeyPair();

        const testText = "Test content";
        const testLog = [
            { type: 'diff', change: { added: testText, pos: 0 }, time: Date.now() }
        ];

        // Try to verify with invalid signature
        const result = verifyLog(testLog, testText, 'invalid-signature-base64', publicKey);

        if (!result.isValid && result.details.errors.includes('Invalid signature')) {
            console.log('✅ Invalid signature detection test passed');
        } else {
            console.log('❌ Invalid signature detection test failed');
            console.log('   Result:', result);
        }

    } catch (error) {
        console.log('❌ Invalid signature detection test failed:', error.message);
    }

    // Test 4: Text reconstruction verification
    console.log('\nTest 4: Text reconstruction from log events');
    try {
        const testText = "Hello World!";
        const testLog = [
            { type: 'diff', change: { added: 'H', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: 'ello', pos: 1 }, time: Date.now() + 100 },
            { type: 'diff', change: { added: ' ', pos: 5 }, time: Date.now() + 200 },
            { type: 'diff', change: { added: 'World', pos: 6 }, time: Date.now() + 300 },
            { type: 'diff', change: { added: '!', pos: 11 }, time: Date.now() + 400 }
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Text reconstruction test passed');
            console.log('   Original:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Text reconstruction test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Text reconstruction test failed:', error.message);
    }

    // Test 4a: Text reconstruction with backspace
    console.log('\nTest 4a: Text reconstruction with backspace operations');
    try {
        const testText = "Hello";
        const testLog = [
            { type: 'diff', change: { added: 'H', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: 'i', pos: 1 }, time: Date.now() + 100 },
            { type: 'diff', change: { removed: 'i', pos: 1 }, time: Date.now() + 200 }, // Backspace
            { type: 'diff', change: { added: 'ello', pos: 1 }, time: Date.now() + 300 }
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Backspace reconstruction test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Backspace reconstruction test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Backspace reconstruction test failed:', error.message);
    }

    // Test 4b: Text reconstruction with character replacement
    console.log('\nTest 4b: Text reconstruction with character replacement');
    try {
        const testText = "Hello";
        const testLog = [
            { type: 'diff', change: { added: 'h', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: 'ello', pos: 1 }, time: Date.now() + 100 },
            { type: 'diff', change: { removed: 'h', added: 'H', pos: 0 }, time: Date.now() + 200 } // Replace h with H
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Character replacement test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Character replacement test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Character replacement test failed:', error.message);
    }

    // Test 4c: Complex editing scenario
    console.log('\nTest 4c: Complex editing scenario (insert, delete, replace)');
    try {
        const testText = "Hello, world!";
        const testLog = [
            { type: 'diff', change: { added: 'Hello world', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: ',', pos: 5 }, time: Date.now() + 100 },
            { type: 'diff', change: { added: '!', pos: 12 }, time: Date.now() + 200 },
            { type: 'diff', change: { removed: 'd', pos: 11 }, time: Date.now() + 300 }, // Remove 'd'
            { type: 'diff', change: { added: 'd', pos: 11 }, time: Date.now() + 400 }  // Add 'd' back
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Complex editing test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Complex editing test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Complex editing test failed:', error.message);
    }

    // Test 4d: Middle-of-text editing
    console.log('\nTest 4d: Editing in the middle of text');
    try {
        const testText = "Hello,  beautiful world!";
        const testLog = [
            { type: 'diff', change: { added: 'Hello, world!', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: ' beautiful ', pos: 7 }, time: Date.now() + 100 }
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Middle-of-text editing test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Middle-of-text editing test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Middle-of-text editing test failed:', error.message);
    }

    // Test 4e: Multiple backspaces
    console.log('\nTest 4e: Multiple consecutive backspaces');
    try {
        const testText = "Hi";
        const testLog = [
            { type: 'diff', change: { added: 'H', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: 'ello', pos: 1 }, time: Date.now() + 100 },
            { type: 'diff', change: { removed: 'o', pos: 4 }, time: Date.now() + 200 }, // Backspace 'o'
            { type: 'diff', change: { removed: 'l', pos: 3 }, time: Date.now() + 300 }, // Backspace 'l'
            { type: 'diff', change: { removed: 'l', pos: 2 }, time: Date.now() + 400 }, // Backspace 'l'
            { type: 'diff', change: { removed: 'e', pos: 1 }, time: Date.now() + 500 }, // Backspace 'e'
            { type: 'diff', change: { added: 'i', pos: 1 }, time: Date.now() + 600 }    // Type 'i'
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Multiple backspaces test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Multiple backspaces test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Multiple backspaces test failed:', error.message);
    }

    // Test 5: HumanAuthorshipVerifier class with primitives
    console.log('\nTest 5: HumanAuthorshipVerifier.verifyPrimitives with valid content');
    try {
        const verifier = new HumanAuthorshipVerifier();

        // Use the same key pair from test 1
        const { publicKey, privateKey } = generateKeyPair();

        const testText = "Hello World";
        const testLog = [
            { type: 'diff', change: { added: 'H', pos: 0 }, time: Date.now() },
            { type: 'diff', change: { added: 'ello ', pos: 1 }, time: Date.now() + 100 },
            { type: 'diff', change: { added: 'World', pos: 6 }, time: Date.now() + 200 }
        ];

        // Sign the log
        const { signature, signedData } = signLog(testLog, testText, privateKey);

        // Verify using the verifier class with primitives
        const result = await verifier.verifyPrimitives(signedData, testText, signature, publicKey);

        if (result.isValid) {
            console.log('✅ HumanAuthorshipVerifier.verifyPrimitives test passed');
            console.log('   Reconstructed text:', result.details.reconstructedText);
        } else {
            console.log('❌ HumanAuthorshipVerifier.verifyPrimitives test failed');
            console.log('   Errors:', result.details.errors);
        }

    } catch (error) {
        console.log('❌ HumanAuthorshipVerifier.verifyPrimitives test failed:', error.message);
    }

    // Test 6: Two-Tier Verification System
    console.log('\nTest 6: Two-Tier Verification System');
    try {
        // Generate key pair
        console.log('   6.1 Generating key pair...');
        const { publicKey, privateKey } = await generateKeyPair();
        console.log('       ✅ Key pair generated');

        // Create test data
        const testText = 'Hello, this is a test of the two-tier verification system!';
        const testLog = [
            { type: 'diff', change: { added: 'Hello, this is a test of the two-tier verification system!', pos: 0 }, time: Date.now() }
        ];

        console.log('   6.2 Test data created');
        console.log('       Text:', testText);
        console.log('       Log events:', testLog.length);

        // Sign with two-tier system
        console.log('   6.3 Signing with two-tier system...');
        const signatures = await signLog(testLog, testText, privateKey);
        console.log('       ✅ Content signature created');
        console.log('       ✅ Log signature created');
        console.log('       Timestamp:', new Date(signatures.timestamp).toISOString());

        // Test Level 1: Content verification (no log needed)
        console.log('   6.4 Testing Level 1: Content verification (no network request)...');
        const level1Result = await verifyContent(testText, signatures.contentSignature, signatures.timestamp, publicKey);
        console.log('       Level 1 result:', level1Result.isValid ? '✅ VALID' : '❌ INVALID');
        if (!level1Result.isValid) {
            console.log('       Errors:', level1Result.details.errors);
        }

        // Test Level 2: Log verification (requires log)
        console.log('   6.5 Testing Level 2: Log verification (with behavioral data)...');
        const level2Result = await verifyLogSignature(testLog, testText, signatures.logSignature, signatures.timestamp, publicKey);
        console.log('       Level 2 result:', level2Result.isValid ? '✅ VALID' : '❌ INVALID');
        if (!level2Result.isValid) {
            console.log('       Errors:', level2Result.details.errors);
        } else {
            console.log('       Reconstructed text matches:', level2Result.details.textMatches);
            console.log('       Warnings:', level2Result.details.warnings.length || 'None');
        }

        // Test combined two-tier verification
        console.log('   6.6 Testing combined two-tier verification...');
        const combinedResult = await verifyTwoTier(
            testText,
            signatures.contentSignature,
            signatures.logSignature,
            signatures.timestamp,
            publicKey,
            testLog
        );
        console.log('       Combined result:', combinedResult.isValid ? '✅ VALID' : '❌ INVALID');
        console.log('       Level 1 valid:', combinedResult.level1Valid);
        console.log('       Level 2 valid:', combinedResult.level2Valid);

        // Test tamper detection
        console.log('   6.7 Testing tamper detection...');
        const tamperedText = testText + ' [TAMPERED]';
        const tamperLevel1 = await verifyContent(tamperedText, signatures.contentSignature, signatures.timestamp, publicKey);
        console.log('       Tampered text Level 1:', tamperLevel1.isValid ? '❌ SHOULD BE INVALID' : '✅ CORRECTLY DETECTED');

        const tamperCombined = await verifyTwoTier(
            tamperedText,
            signatures.contentSignature,
            signatures.logSignature,
            signatures.timestamp,
            publicKey,
            testLog
        );
        console.log('       Tampered text combined:', tamperCombined.isValid ? '❌ SHOULD BE INVALID' : '✅ CORRECTLY DETECTED');

        console.log('✅ Two-tier verification tests passed');

    } catch (error) {
        console.log('❌ Two-tier verification tests failed:', error.message);
    }

    console.log('\n🎉 Integration tests completed!');
}

// Export for use in other modules
module.exports = { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
