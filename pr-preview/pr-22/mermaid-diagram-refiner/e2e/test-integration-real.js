// Real LLM Integration Tests for Mermaid Diagram Refiner
// Tests semantic structure and behavior with actual LLM calls
// Note: These tests require LMStudio running on localhost:1234

const LLM_BASE_URL = 'http://localhost:1234/v1/chat/completions';
const MODEL_NAME = 'qwen/qwen3-4b-thinking-2507';

// Test state
let currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;

let conversationMessages = [];

// Mock localStorage for testing
const mockLocalStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    removeItem: function(key) { delete this.data[key]; },
    clear: function() { this.data = {}; }
};

// Override global localStorage
global.localStorage = mockLocalStorage;

// Utility functions
function resetTestState() {
    currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;
    conversationMessages = [];
    mockLocalStorage.clear();
}

function estimateTokens(text) {
    return Math.ceil(text.length / 4);
}

function saveMessageToStorage(role, content, type = 'normal') {
    const message = { role, content, type };
    conversationMessages.push(message);
}

async function callRealLLM(messages, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(LLM_BASE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                messages: messages,
                tools: [
                    {
                        type: 'function',
                        function: {
                            name: 'add_node',
                            description: 'Add a new node to the flowchart',
                            parameters: {
                                type: 'object',
                                properties: {
                                    id: { type: 'string', description: 'Unique node ID' },
                                    label: { type: 'string', description: 'Node label' }
                                },
                                required: ['id', 'label']
                            }
                        }
                    },
                    {
                        type: 'function',
                        function: {
                            name: 'add_edge',
                            description: 'Add an edge between two nodes',
                            parameters: {
                                type: 'object',
                                properties: {
                                    from: { type: 'string', description: 'Source node ID' },
                                    to: { type: 'string', description: 'Target node ID' },
                                    label: { type: 'string', description: 'Edge label (optional)' }
                                },
                                required: ['from', 'to']
                            }
                        }
                    }
                ],
                tool_choice: 'auto',
                stream: false // Use non-streaming for tests
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`LLM API error: ${response.status}`);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('LLM request timed out');
        }
        throw error;
    }
}

// Test utilities
function assert(condition, message) {
    if (!condition) {
        throw new Error(`❌ ASSERTION FAILED: ${message}`);
    }
}

function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected "${substring}" in "${text}"`);
    }
}

function assertToolCall(response, toolName, message) {
    const hasToolCall = response.choices[0].message.tool_calls &&
                       response.choices[0].message.tool_calls.some(call => call.function.name === toolName);
    if (!hasToolCall) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected tool call to ${toolName}`);
    }
}

function assertNoThinking(response, message) {
    const content = response.choices[0].message.content || '';
    if (content.includes('<think>')) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nUnexpected thinking tags in response`);
    }
}

function assertThinking(response, message) {
    const content = response.choices[0].message.content || '';
    if (!content.includes('<think>')) {
        throw new Error(`❌ ASSERTION FAILED: ${message}\nExpected thinking tags in response`);
    }
}

// Test suites
async function testBasicLLMConnectivity() {
    console.log('🌐 Testing LLM Connectivity\n');

    resetTestState();

    // Test 1: Basic connectivity
    console.log('Test 1: Basic LLM connectivity');
    try {
        const messages = [
            { role: 'user', content: 'Hello, respond with just "Hello back"' }
        ];
        const response = await callRealLLM(messages, 10000);
        assert(response.choices && response.choices[0], 'Should receive valid response');
        assert(typeof response.choices[0].message.content === 'string', 'Should have content');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }
}

async function testToolCallingBehavior() {
    console.log('🔧 Testing Tool Calling Behavior\n');

    resetTestState();

    // Test 1: Should call add_node tool for clear request
    console.log('Test 1: Tool call for clear diagram modification request');
    try {
        const messages = [
            {
                role: 'system',
                content: `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nUse tools to modify diagrams when requested.`
            },
            { role: 'user', content: 'Add a new node called "Review" with ID "D"' }
        ];
        const response = await callRealLLM(messages);
        assertToolCall(response, 'add_node', 'Should call add_node tool for clear request');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }

    // Test 2: Should not call tools for unclear requests
    console.log('Test 2: No tool calls for unclear requests');
    try {
        const messages = [
            {
                role: 'system',
                content: `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nUse tools to modify diagrams when requested.`
            },
            { role: 'user', content: 'What can you do?' }
        ];
        const response = await callRealLLM(messages);
        const hasToolCalls = response.choices[0].message.tool_calls && response.choices[0].message.tool_calls.length > 0;
        assert(!hasToolCalls, 'Should not call tools for unclear requests');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }
}

async function testThinkingBehavior() {
    console.log('🤔 Testing Thinking Behavior\n');

    resetTestState();

    // Test 1: Should include thinking for complex requests
    console.log('Test 1: Thinking tags for complex requests');
    try {
        const messages = [
            {
                role: 'system',
                content: `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nAnalyze requests carefully and use thinking tags.`
            },
            { role: 'user', content: 'Add a validation step and connect it properly to the existing flow' }
        ];
        const response = await callRealLLM(messages);
        assertThinking(response, 'Should include thinking for complex analysis');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }

    // Test 2: Should skip thinking when explicitly told not to
    console.log('Test 2: Skip thinking when instructed');
    try {
        const messages = [
            {
                role: 'system',
                content: `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nIMPORTANT: DO NOT use <think> tags. Respond directly.`
            },
            { role: 'user', content: 'Add a simple node called Test' }
        ];
        const response = await callRealLLM(messages);
        assertNoThinking(response, 'Should not include thinking when instructed not to');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }
}

async function testSkipThinkingSimulation() {
    console.log('⏭️ Testing Skip Thinking Simulation\n');

    resetTestState();

    // Test 1: Simulate skip thinking by completing thinking block
    console.log('Test 1: Skip thinking continuation');
    try {
        // First, get a response with thinking
        const thinkingMessages = [
            {
                role: 'system',
                content: `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nAnalyze requests carefully.`
            },
            { role: 'user', content: 'Should I add a review step to this process?' }
        ];
        const thinkingResponse = await callRealLLM(thinkingMessages);
        assertThinking(thinkingResponse, 'Should include thinking initially');

        // Now simulate skip thinking by adding completed thinking to history
        const completedThinking = '<think>Analyzing the request for adding a review step...</think>';
        conversationMessages.push({ role: 'assistant', content: completedThinking });

        // Continue with instruction to skip thinking
        const continuationMessages = [
            {
                role: 'system',
                content: `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nIMPORTANT: You have already completed your thinking. DO NOT use <think> tags again.`
            },
            { role: 'assistant', content: completedThinking },
            { role: 'user', content: 'Now provide your final response without thinking.' }
        ];
        const continuationResponse = await callRealLLM(continuationMessages);
        assertNoThinking(continuationResponse, 'Should not include thinking in continuation');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }
}

async function testContextManagement() {
    console.log('📊 Testing Context Management\n');

    resetTestState();

    // Test 1: Context accumulation
    console.log('Test 1: Context accumulation over multiple messages');
    try {
        // Add several messages to build context
        saveMessageToStorage('user', 'Add a start node');
        saveMessageToStorage('assistant', 'I added a start node');
        saveMessageToStorage('user', 'Now add an end node');
        saveMessageToStorage('assistant', 'I added an end node');

        const totalTokens = conversationMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
        assert(totalTokens > 10, 'Should accumulate context tokens');
        console.log('✅ PASS\n');
    } catch (error) {
        console.log(`❌ FAIL - ${error.message}\n`);
        throw error;
    }
}

async function runRealIntegrationTests() {
    console.log('🚀 Running Real LLM Integration Tests\n');
    console.log('⚠️  These tests require LMStudio running on localhost:1234\n');
    console.log('=' .repeat(60) + '\n');

    try {
        await testBasicLLMConnectivity();
        await testToolCallingBehavior();
        await testThinkingBehavior();
        await testSkipThinkingSimulation();
        await testContextManagement();

        console.log('🎉 All real integration tests passed!\n');
        console.log('📈 Real Integration Test Coverage:');
        console.log('  ✅ LLM Connectivity & Response Format');
        console.log('  ✅ Tool Calling Logic & Conditions');
        console.log('  ✅ Thinking Behavior & Control');
        console.log('  ✅ Skip Thinking Simulation');
        console.log('  ✅ Context Management & Accumulation\n');

    } catch (error) {
        console.error('💥 Real integration tests failed:', error.message);
        console.log('\n💡 Make sure LMStudio is running on localhost:1234 with the correct model loaded');
        process.exit(1);
    }
}

// Run tests if called directly
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        callRealLLM,
        resetTestState,
        testBasicLLMConnectivity,
        testToolCallingBehavior,
        testThinkingBehavior,
        testSkipThinkingSimulation,
        testContextManagement
    };
} else {
    runRealIntegrationTests();
}
