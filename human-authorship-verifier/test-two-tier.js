/**
 * Test script for two-tier verification system
 */

const { generateKeyPair, signLog, verifyContent, verifyLogSignature, verifyTwoTier } = require('./hav-core');

async function testTwoTierVerification() {
    console.log('Testing Two-Tier Verification System\n');

    try {
        // Generate key pair
        console.log('1. Generating key pair...');
        const { publicKey, privateKey } = await generateKeyPair();
        console.log('   ✅ Key pair generated\n');

        // Create test data
        const testText = 'Hello, this is a test of the two-tier verification system!';
        const testLog = [
            { type: 'diff', change: { added: 'Hello, this is a test of the two-tier verification system!', pos: 0 }, time: Date.now() }
        ];

        console.log('2. Test data created');
        console.log('   Text:', testText);
        console.log('   Log events:', testLog.length, '\n');

        // Sign with two-tier system
        console.log('3. Signing with two-tier system...');
        const signatures = await signLog(testLog, testText, privateKey);
        console.log('   ✅ Content signature created');
        console.log('   ✅ Log signature created');
        console.log('   Timestamp:', new Date(signatures.timestamp).toISOString(), '\n');

        // Test Level 1: Content verification (no log needed)
        console.log('4. Testing Level 1: Content verification (no network request)...');
        const level1Result = await verifyContent(testText, signatures.contentSignature, signatures.timestamp, publicKey);
        console.log('   Level 1 result:', level1Result.isValid ? '✅ VALID' : '❌ INVALID');
        if (!level1Result.isValid) {
            console.log('   Errors:', level1Result.details.errors);
        }
        console.log('');

        // Test Level 2: Log verification (requires log)
        console.log('5. Testing Level 2: Log verification (with behavioral data)...');
        const level2Result = await verifyLogSignature(testLog, testText, signatures.logSignature, signatures.timestamp, publicKey);
        console.log('   Level 2 result:', level2Result.isValid ? '✅ VALID' : '❌ INVALID');
        if (!level2Result.isValid) {
            console.log('   Errors:', level2Result.details.errors);
        } else {
            console.log('   Reconstructed text matches:', level2Result.details.textMatches);
            console.log('   Warnings:', level2Result.details.warnings.length || 'None');
        }
        console.log('');

        // Test combined two-tier verification
        console.log('6. Testing combined two-tier verification...');
        const combinedResult = await verifyTwoTier(
            testText,
            signatures.contentSignature,
            signatures.logSignature,
            signatures.timestamp,
            publicKey,
            testLog
        );
        console.log('   Combined result:', combinedResult.isValid ? '✅ VALID' : '❌ INVALID');
        console.log('   Level 1 valid:', combinedResult.level1Valid);
        console.log('   Level 2 valid:', combinedResult.level2Valid);
        console.log('');

        // Test tamper detection
        console.log('7. Testing tamper detection...');
        const tamperedText = testText + ' [TAMPERED]';
        const tamperLevel1 = await verifyContent(tamperedText, signatures.contentSignature, signatures.timestamp, publicKey);
        console.log('   Tampered text Level 1:', tamperLevel1.isValid ? '❌ SHOULD BE INVALID' : '✅ CORRECTLY DETECTED');

        const tamperCombined = await verifyTwoTier(
            tamperedText,
            signatures.contentSignature,
            signatures.logSignature,
            signatures.timestamp,
            publicKey,
            testLog
        );
        console.log('   Tampered text combined:', tamperCombined.isValid ? '❌ SHOULD BE INVALID' : '✅ CORRECTLY DETECTED');
        console.log('');

        console.log('🎉 Two-tier verification tests completed successfully!');

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testTwoTierVerification();
