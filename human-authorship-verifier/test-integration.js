/**
 * Human Authorship Verifier - Node.js Integration Tests
 * Tests the complete end-to-end flow using the actual core library
 */

const { generateKeyPair, signLog, verifyLog, reconstructText } = require('./hav-core');
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

    console.log('\n🎉 Integration tests completed!');
}

// Export for use in other modules
module.exports = { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
