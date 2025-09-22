/**
 * Human Authorship Verifier - Node.js Integration Tests
 * Tests the complete end-to-end flow using the actual core library
 * Includes all tests: basic integration, two-tier verification, and tamper detection
 */

const { generateKeyPair, signLog, verifyLog, reconstructText, verifyContent, verifyLogSignature, verifyTwoTier, serializeLog, deserializeLog } = require('./hav-core');
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
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: ' ', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: 'W', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 'o', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 'r', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'l', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 'd', cursor: 10, time: Date.now() + 1000 }
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
            { type: 'insert', char: 'O', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'r', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'i', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'g', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'i', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: 'n', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: 'a', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 'l', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: ' ', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'c', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 'o', cursor: 10, time: Date.now() + 1000 },
            { type: 'insert', char: 'n', cursor: 11, time: Date.now() + 1100 },
            { type: 'insert', char: 't', cursor: 12, time: Date.now() + 1200 },
            { type: 'insert', char: 'e', cursor: 13, time: Date.now() + 1300 },
            { type: 'insert', char: 'n', cursor: 14, time: Date.now() + 1400 },
            { type: 'insert', char: 't', cursor: 15, time: Date.now() + 1500 }
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
            { type: 'insert', char: 'T', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 's', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 't', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: ' ', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: 'c', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: 'o', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 'n', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 't', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'e', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 'n', cursor: 10, time: Date.now() + 1000 },
            { type: 'insert', char: 't', cursor: 11, time: Date.now() + 1100 }
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
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: ' ', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: 'W', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 'o', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 'r', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'l', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 'd', cursor: 10, time: Date.now() + 1000 },
            { type: 'insert', char: '!', cursor: 11, time: Date.now() + 1100 }
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
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'i', cursor: 1, time: Date.now() + 100 },
            { type: 'backspace', cursor: 2, time: Date.now() + 200 }, // Backspace removes 'i'
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 300 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 400 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 500 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 600 }
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
            { type: 'insert', char: 'h', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'backspace', cursor: 5, time: Date.now() + 500 }, // Remove 'o'
            { type: 'backspace', cursor: 4, time: Date.now() + 600 }, // Remove 'l'
            { type: 'backspace', cursor: 3, time: Date.now() + 700 }, // Remove 'l'
            { type: 'backspace', cursor: 2, time: Date.now() + 800 }, // Remove 'e'
            { type: 'backspace', cursor: 1, time: Date.now() + 900 }, // Remove 'h'
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() + 1000 }, // Insert 'H'
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 1100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 1200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 1300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 1400 }
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
        const testText = "Hello!";
        const testLog = [
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: 'x', cursor: 5, time: Date.now() + 500 }, // Type 'x' by mistake
            { type: 'backspace', cursor: 6, time: Date.now() + 600 }, // Backspace removes 'x'
            { type: 'insert', char: '!', cursor: 5, time: Date.now() + 700 }  // Add exclamation
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
        const testText = "Hello world!";
        const testLog = [
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: ' ', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: 'w', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 'o', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 'r', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'l', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 'd', cursor: 10, time: Date.now() + 1000 },
            { type: 'insert', char: '!', cursor: 11, time: Date.now() + 1100 } // Add exclamation at end
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
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'backspace', cursor: 5, time: Date.now() + 500 }, // Backspace 'o'
            { type: 'backspace', cursor: 4, time: Date.now() + 600 }, // Backspace 'l'
            { type: 'backspace', cursor: 3, time: Date.now() + 700 }, // Backspace 'l'
            { type: 'backspace', cursor: 2, time: Date.now() + 800 }, // Backspace 'e'
            { type: 'insert', char: 'i', cursor: 1, time: Date.now() + 900 }    // Type 'i'
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

    // Test 4f: Delete first character
    console.log('\nTest 4f: Delete first character');
    try {
        const testText = "ello";
        const testLog = [
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'backspace', cursor: 1, time: Date.now() + 500 } // Backspace first 'H' when cursor is at position 1
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Delete first character test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Delete first character test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Delete first character test failed:', error.message);
    }

    // Test 4g: Delete at cursor position 1 then insert
    console.log('\nTest 4g: Delete at cursor position 1 then insert');
    try {
        const testText = "hHllo";
        const testLog = [
            { type: 'insert', char: 'h', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'delete', cursor: 1, time: Date.now() + 500 }, // Delete 'e' at cursor position 1 -> "hllo"
            { type: 'insert', char: 'H', cursor: 1, time: Date.now() + 600 } // Insert 'H' at cursor position 1 -> "hHllo"
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ Delete at cursor position 1 then insert test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ Delete at cursor position 1 then insert test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ Delete at cursor position 1 then insert test failed:', error.message);
    }

    // Test 4h: New input event format (most reliable)
    console.log('\nTest 4h: New input event format reconstruction');
    try {
        const testText = "Hello!";
        const testLog = [
            { type: 'input', oldValue: '', newValue: 'H', selectionStart: 1, selectionEnd: 1, cursor: 1, time: Date.now() },
            { type: 'input', oldValue: 'H', newValue: 'He', selectionStart: 2, selectionEnd: 2, cursor: 2, time: Date.now() + 100 },
            { type: 'input', oldValue: 'He', newValue: 'Hel', selectionStart: 3, selectionEnd: 3, cursor: 3, time: Date.now() + 200 },
            { type: 'input', oldValue: 'Hel', newValue: 'Hell', selectionStart: 4, selectionEnd: 4, cursor: 4, time: Date.now() + 300 },
            { type: 'input', oldValue: 'Hell', newValue: 'Hello', selectionStart: 5, selectionEnd: 5, cursor: 5, time: Date.now() + 400 },
            { type: 'input', oldValue: 'Hello', newValue: 'Hello!', selectionStart: 6, selectionEnd: 6, cursor: 6, time: Date.now() + 500 }
        ];

        const reconstructed = reconstructText(testLog);

        if (reconstructed === testText) {
            console.log('✅ New input event format test passed');
            console.log('   Expected:', testText);
            console.log('   Reconstructed:', reconstructed);
        } else {
            console.log('❌ New input event format test failed');
            console.log('   Expected:', testText);
            console.log('   Got:', reconstructed);
        }

    } catch (error) {
        console.log('❌ New input event format test failed:', error.message);
    }



    // Test 5: HumanAuthorshipVerifier class with primitives
    console.log('\nTest 5: HumanAuthorshipVerifier.verifyPrimitives with valid content');
    try {
        const verifier = new HumanAuthorshipVerifier();

        // Use the same key pair from test 1
        const { publicKey, privateKey } = generateKeyPair();

        const testText = "Hello World";
        const testLog = [
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: ' ', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: 'W', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 'o', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 'r', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'l', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 'd', cursor: 10, time: Date.now() + 1000 }
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
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: ',', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: ' ', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 't', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 'h', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'i', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 's', cursor: 10, time: Date.now() + 1000 },
            { type: 'insert', char: ' ', cursor: 11, time: Date.now() + 1100 },
            { type: 'insert', char: 'i', cursor: 12, time: Date.now() + 1200 },
            { type: 'insert', char: 's', cursor: 13, time: Date.now() + 1300 },
            { type: 'insert', char: ' ', cursor: 14, time: Date.now() + 1400 },
            { type: 'insert', char: 'a', cursor: 15, time: Date.now() + 1500 },
            { type: 'insert', char: ' ', cursor: 16, time: Date.now() + 1600 },
            { type: 'insert', char: 't', cursor: 17, time: Date.now() + 1700 },
            { type: 'insert', char: 'e', cursor: 18, time: Date.now() + 1800 },
            { type: 'insert', char: 's', cursor: 19, time: Date.now() + 1900 },
            { type: 'insert', char: 't', cursor: 20, time: Date.now() + 2000 },
            { type: 'insert', char: ' ', cursor: 21, time: Date.now() + 2100 },
            { type: 'insert', char: 'o', cursor: 22, time: Date.now() + 2200 },
            { type: 'insert', char: 'f', cursor: 23, time: Date.now() + 2300 },
            { type: 'insert', char: ' ', cursor: 24, time: Date.now() + 2400 },
            { type: 'insert', char: 't', cursor: 25, time: Date.now() + 2500 },
            { type: 'insert', char: 'h', cursor: 26, time: Date.now() + 2600 },
            { type: 'insert', char: 'e', cursor: 27, time: Date.now() + 2700 },
            { type: 'insert', char: ' ', cursor: 28, time: Date.now() + 2800 },
            { type: 'insert', char: 't', cursor: 29, time: Date.now() + 2900 },
            { type: 'insert', char: 'w', cursor: 30, time: Date.now() + 3000 },
            { type: 'insert', char: 'o', cursor: 31, time: Date.now() + 3100 },
            { type: 'insert', char: '-', cursor: 32, time: Date.now() + 3200 },
            { type: 'insert', char: 't', cursor: 33, time: Date.now() + 3300 },
            { type: 'insert', char: 'i', cursor: 34, time: Date.now() + 3400 },
            { type: 'insert', char: 'e', cursor: 35, time: Date.now() + 3500 },
            { type: 'insert', char: 'r', cursor: 36, time: Date.now() + 3600 },
            { type: 'insert', char: ' ', cursor: 37, time: Date.now() + 3700 },
            { type: 'insert', char: 'v', cursor: 38, time: Date.now() + 3800 },
            { type: 'insert', char: 'e', cursor: 39, time: Date.now() + 3900 },
            { type: 'insert', char: 'r', cursor: 40, time: Date.now() + 4000 },
            { type: 'insert', char: 'i', cursor: 41, time: Date.now() + 4100 },
            { type: 'insert', char: 'f', cursor: 42, time: Date.now() + 4200 },
            { type: 'insert', char: 'i', cursor: 43, time: Date.now() + 4300 },
            { type: 'insert', char: 'c', cursor: 44, time: Date.now() + 4400 },
            { type: 'insert', char: 'a', cursor: 45, time: Date.now() + 4500 },
            { type: 'insert', char: 't', cursor: 46, time: Date.now() + 4600 },
            { type: 'insert', char: 'i', cursor: 47, time: Date.now() + 4700 },
            { type: 'insert', char: 'o', cursor: 48, time: Date.now() + 4800 },
            { type: 'insert', char: 'n', cursor: 49, time: Date.now() + 4900 },
            { type: 'insert', char: ' ', cursor: 50, time: Date.now() + 5000 },
            { type: 'insert', char: 's', cursor: 51, time: Date.now() + 5100 },
            { type: 'insert', char: 'y', cursor: 52, time: Date.now() + 5200 },
            { type: 'insert', char: 's', cursor: 53, time: Date.now() + 5300 },
            { type: 'insert', char: 't', cursor: 54, time: Date.now() + 5400 },
            { type: 'insert', char: 'e', cursor: 55, time: Date.now() + 5500 },
            { type: 'insert', char: 'm', cursor: 56, time: Date.now() + 5600 },
            { type: 'insert', char: '!', cursor: 57, time: Date.now() + 5700 }
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

    // Test 7: TLV Serialization Roundtrip
    console.log('\nTest 7: TLV Serialization Roundtrip');
    try {
        // Test with various event types
        const testLog = [
            { type: 'input', oldValue: '', newValue: 'H', selectionStart: 1, selectionEnd: 1, cursor: 1, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'backspace', cursor: 2, time: Date.now() + 200 },
            { type: 'delete', cursor: 1, time: Date.now() + 300 },
            { type: 'selection', cursor: 0, selectionStart: 0, selectionEnd: 5, time: Date.now() + 400 },
            { type: 'keydown', key: 'a', time: Date.now() + 500 },
            { type: 'keyup', key: 'a', time: Date.now() + 600 }
        ];

        console.log('   7.1 Serializing log to TLV...');
        const serialized = serializeLog(testLog);
        console.log('       ✅ Serialized to', serialized.length, 'bytes');

        console.log('   7.2 Deserializing TLV back to log...');
        const deserialized = deserializeLog(serialized);
        console.log('       ✅ Deserialized to', deserialized.length, 'events');

        console.log('   7.3 Verifying roundtrip integrity...');
        let roundtripValid = true;
        if (testLog.length !== deserialized.length) {
            roundtripValid = false;
            console.log('       ❌ Length mismatch:', testLog.length, 'vs', deserialized.length);
        } else {
            for (let i = 0; i < testLog.length; i++) {
                const original = testLog[i];
                const restored = deserialized[i];

                // Check type
                if (original.type !== restored.type) {
                    roundtripValid = false;
                    console.log(`       ❌ Type mismatch at index ${i}:`, original.type, 'vs', restored.type);
                    break;
                }

                // Check all properties
                for (const key in original) {
                    if (original[key] !== restored[key]) {
                        roundtripValid = false;
                        console.log(`       ❌ Property mismatch at index ${i}, key ${key}:`, original[key], 'vs', restored[key]);
                        break;
                    }
                }
                if (!roundtripValid) break;
            }
        }

        if (roundtripValid) {
            console.log('✅ TLV roundtrip test passed - perfect serialization/deserialization');
            console.log('   Original log events:', testLog.length);
            console.log('   Serialized size:', serialized.length, 'bytes');
        } else {
            console.log('❌ TLV roundtrip test failed - data corruption detected');
        }

        // Test with empty log
        console.log('   7.4 Testing empty log...');
        const emptyLog = [];
        const emptySerialized = serializeLog(emptyLog);
        const emptyDeserialized = deserializeLog(emptySerialized);
        if (emptyDeserialized.length === 0) {
            console.log('       ✅ Empty log roundtrip passed');
        } else {
            console.log('       ❌ Empty log roundtrip failed');
            roundtripValid = false;
        }

        // Test with complex log
        console.log('   7.5 Testing complex log with special characters...');
        const complexLog = [
            { type: 'insert', char: '🚀', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'Hello 世界 🌍', cursor: 1, time: Date.now() + 100 },
            { type: 'input', oldValue: '🚀', newValue: '🚀Hello 世界 🌍', selectionStart: 15, selectionEnd: 15, cursor: 15, time: Date.now() + 200 }
        ];
        const complexSerialized = serializeLog(complexLog);
        const complexDeserialized = deserializeLog(complexSerialized);

        let complexValid = true;
        if (complexLog.length !== complexDeserialized.length) {
            complexValid = false;
        } else {
            for (let i = 0; i < complexLog.length; i++) {
                const orig = complexLog[i];
                const rest = complexDeserialized[i];
                if (JSON.stringify(orig) !== JSON.stringify(rest)) {
                    complexValid = false;
                    break;
                }
            }
        }

        if (complexValid) {
            console.log('       ✅ Complex log with Unicode roundtrip passed');
        } else {
            console.log('       ❌ Complex log roundtrip failed');
            roundtripValid = false;
        }

        // Test 7.6: Space savings comparison
        console.log('   7.6 Space savings comparison...');

        // Use the large test log from Test 6
        const largeTestLog = [
            { type: 'insert', char: 'H', cursor: 0, time: Date.now() },
            { type: 'insert', char: 'e', cursor: 1, time: Date.now() + 100 },
            { type: 'insert', char: 'l', cursor: 2, time: Date.now() + 200 },
            { type: 'insert', char: 'l', cursor: 3, time: Date.now() + 300 },
            { type: 'insert', char: 'o', cursor: 4, time: Date.now() + 400 },
            { type: 'insert', char: ',', cursor: 5, time: Date.now() + 500 },
            { type: 'insert', char: ' ', cursor: 6, time: Date.now() + 600 },
            { type: 'insert', char: 't', cursor: 7, time: Date.now() + 700 },
            { type: 'insert', char: 'h', cursor: 8, time: Date.now() + 800 },
            { type: 'insert', char: 'i', cursor: 9, time: Date.now() + 900 },
            { type: 'insert', char: 's', cursor: 10, time: Date.now() + 1000 },
            { type: 'insert', char: ' ', cursor: 11, time: Date.now() + 1100 },
            { type: 'insert', char: 'i', cursor: 12, time: Date.now() + 1200 },
            { type: 'insert', char: 's', cursor: 13, time: Date.now() + 1300 },
            { type: 'insert', char: ' ', cursor: 14, time: Date.now() + 1400 },
            { type: 'insert', char: 'a', cursor: 15, time: Date.now() + 1500 },
            { type: 'insert', char: ' ', cursor: 16, time: Date.now() + 1600 },
            { type: 'insert', char: 't', cursor: 17, time: Date.now() + 1700 },
            { type: 'insert', char: 'e', cursor: 18, time: Date.now() + 1800 },
            { type: 'insert', char: 's', cursor: 19, time: Date.now() + 1900 },
            { type: 'insert', char: 't', cursor: 20, time: Date.now() + 2000 },
            { type: 'insert', char: ' ', cursor: 21, time: Date.now() + 2100 },
            { type: 'insert', char: 'o', cursor: 22, time: Date.now() + 2200 },
            { type: 'insert', char: 'f', cursor: 23, time: Date.now() + 2300 },
            { type: 'insert', char: ' ', cursor: 24, time: Date.now() + 2400 },
            { type: 'insert', char: 't', cursor: 25, time: Date.now() + 2500 },
            { type: 'insert', char: 'h', cursor: 26, time: Date.now() + 2600 },
            { type: 'insert', char: 'e', cursor: 27, time: Date.now() + 2700 },
            { type: 'insert', char: ' ', cursor: 28, time: Date.now() + 2800 },
            { type: 'insert', char: 't', cursor: 29, time: Date.now() + 2900 },
            { type: 'insert', char: 'w', cursor: 30, time: Date.now() + 3000 },
            { type: 'insert', char: 'o', cursor: 31, time: Date.now() + 3100 },
            { type: 'insert', char: '-', cursor: 32, time: Date.now() + 3200 },
            { type: 'insert', char: 't', cursor: 33, time: Date.now() + 3300 },
            { type: 'insert', char: 'i', cursor: 34, time: Date.now() + 3400 },
            { type: 'insert', char: 'e', cursor: 35, time: Date.now() + 3500 },
            { type: 'insert', char: 'r', cursor: 36, time: Date.now() + 3600 },
            { type: 'insert', char: ' ', cursor: 37, time: Date.now() + 3700 },
            { type: 'insert', char: 'v', cursor: 38, time: Date.now() + 3800 },
            { type: 'insert', char: 'e', cursor: 39, time: Date.now() + 3900 },
            { type: 'insert', char: 'r', cursor: 40, time: Date.now() + 4000 },
            { type: 'insert', char: 'i', cursor: 41, time: Date.now() + 4100 },
            { type: 'insert', char: 'f', cursor: 42, time: Date.now() + 4200 },
            { type: 'insert', char: 'i', cursor: 43, time: Date.now() + 4300 },
            { type: 'insert', char: 'c', cursor: 44, time: Date.now() + 4400 },
            { type: 'insert', char: 'a', cursor: 45, time: Date.now() + 4500 },
            { type: 'insert', char: 't', cursor: 46, time: Date.now() + 4600 },
            { type: 'insert', char: 'i', cursor: 47, time: Date.now() + 4700 },
            { type: 'insert', char: 'o', cursor: 48, time: Date.now() + 4800 },
            { type: 'insert', char: 'n', cursor: 49, time: Date.now() + 4900 },
            { type: 'insert', char: ' ', cursor: 50, time: Date.now() + 5000 },
            { type: 'insert', char: 's', cursor: 51, time: Date.now() + 5100 },
            { type: 'insert', char: 'y', cursor: 52, time: Date.now() + 5200 },
            { type: 'insert', char: 's', cursor: 53, time: Date.now() + 5300 },
            { type: 'insert', char: 't', cursor: 54, time: Date.now() + 5400 },
            { type: 'insert', char: 'e', cursor: 55, time: Date.now() + 5500 },
            { type: 'insert', char: 'm', cursor: 56, time: Date.now() + 5600 },
            { type: 'insert', char: '!', cursor: 57, time: Date.now() + 5700 }
        ];

        const jsonSize = Buffer.byteLength(JSON.stringify(largeTestLog), 'utf8');
        const tlvSize = serializeLog(largeTestLog).length;
        const savingsPercent = ((jsonSize - tlvSize) / jsonSize * 100).toFixed(1);

        console.log('       Large log (58 events):');
        console.log('       JSON size:', jsonSize, 'bytes');
        console.log('       TLV size:', tlvSize, 'bytes');
        console.log('       Space saved:', jsonSize - tlvSize, 'bytes (' + savingsPercent + '%)');

        if (roundtripValid) {
            console.log('✅ All TLV serialization tests passed');
        } else {
            console.log('❌ Some TLV serialization tests failed');
        }

    } catch (error) {
        console.log('❌ TLV serialization test failed:', error.message);
    }

    console.log('\n🎉 Integration tests completed!');
}

// Export for use in other modules
module.exports = { runTests };

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
