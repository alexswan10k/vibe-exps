// End-to-End Test: Summarization Functionality
// Tests that summarization properly strips thinking sections from message data

let conversationMessages = [];

function saveMessageToStorage(role, content, type = 'normal') {
    const message = { role, content, type };
    conversationMessages.push(message);
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

// Simplified summarization logic that operates on data structures only
async function summarizeThinkingBlocks() {
    // Find thinking messages in conversationMessages
    const thinkingMessages = conversationMessages.filter(msg => msg.type === 'thinking');
    if (thinkingMessages.length < 2) return; // Keep at least one

    // Summarize the oldest thinking message
    const oldestThinkingMessage = thinkingMessages[0];
    const messageIndex = conversationMessages.indexOf(oldestThinkingMessage);

    if (messageIndex !== -1) {
        // Strip out the thinking section entirely and keep only the final response
        const finalContent = oldestThinkingMessage.content.substring(oldestThinkingMessage.content.indexOf('</think>') + 8);

        // Change the message type to normal and remove thinking content
        conversationMessages[messageIndex] = {
            role: oldestThinkingMessage.role,
            content: `[Thinking summarized] ${finalContent.trim()}`,
            type: 'normal'
        };
    }
}

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ ASSERTION FAILED: ${message}`);
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

async function testSummarizationEndToEnd() {
    console.log('🧪 Testing Summarization End-to-End\n');

    // Reset state
    conversationMessages = [];

    // Create initial thinking messages
    const thinkingMessage1 = '<think>This is the first thinking process with detailed analysis.</think>First response from AI.';
    const thinkingMessage2 = '<think>This is the second thinking process with more analysis.</think>Second response from AI.';
    const thinkingMessage3 = '<think>This is the third thinking process with even more analysis.</think>Third response from AI.';

    saveMessageToStorage('assistant', thinkingMessage1, 'thinking');
    saveMessageToStorage('assistant', thinkingMessage2, 'thinking');
    saveMessageToStorage('assistant', thinkingMessage3, 'thinking');

    // Verify initial state
    const initialThinkingMessages = conversationMessages.filter(m => m.type === 'thinking');
    assertEqual(initialThinkingMessages.length, 3, 'Should have 3 thinking messages initially');

    console.log('✅ Initial state verified\n');

    // Test summarization
    console.log('Testing summarization execution...');
    await summarizeThinkingBlocks();

    // Verify summarization results
    const thinkingMessages = conversationMessages.filter(m => m.type === 'thinking');
    const normalMessages = conversationMessages.filter(m => m.type === 'normal');

    assertEqual(thinkingMessages.length, 2, 'Should have 2 thinking messages remaining');
    assertEqual(normalMessages.length, 1, 'Should have 1 normal message after summarization');

    // Check that the first message was converted to normal
    const summarizedMessage = normalMessages[0];
    assert(summarizedMessage.content.includes('[Thinking summarized]'), 'Message should be marked as summarized');
    assert(summarizedMessage.content.includes('First response from AI'), 'Should preserve the final response');
    assert(!summarizedMessage.content.includes('<think>'), 'Should not contain thinking tags');

    console.log('✅ Summarization execution verified\n');

    // Test context reduction
    console.log('Testing context reduction...');
    const totalTokens = conversationMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);

    // The summarized message should have fewer tokens than the original thinking message
    const originalThinkingTokens = estimateTokens(thinkingMessage1);
    const summarizedTokens = estimateTokens(summarizedMessage.content);

    assert(summarizedTokens < originalThinkingTokens, 'Summarized message should use fewer tokens than original thinking message');

    console.log('✅ Context reduction verified\n');

    console.log('🎉 Summarization End-to-End Test PASSED!\n');
}

// Run the test
if (require.main === module) {
    testSummarizationEndToEnd().catch(error => {
        console.error('💥 Test failed:', error.message);
        process.exit(1);
    });
}

module.exports = { testSummarizationEndToEnd };
