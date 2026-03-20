/**
 * @typedef {Object} ChatMessage
 * @property {'user'|'assistant'|'system'|'tool'} role - The role of the message sender
 * @property {string} content - The text content of the message
 * @property {'normal'|'thinking'} type - The type of message for UI rendering
 */

/**
 * @typedef {Object} LLMMessage
 * @property {'user'|'assistant'|'system'|'tool'} role - The role for LLM API
 * @property {string} content - The content to send to LLM
 * @property {string} [tool_call_id] - Tool call ID if this is a tool response
 */

let currentDiagram = `graph TD
A[Start] --> B[Process]
B --> C[End]`;

/** @type {ChatMessage[]} */
let conversationMessages = [];
const MAX_CONTEXT_TOKENS = 32000; // Approximate for qwen model
const CONTEXT_WARNING_THRESHOLD = 0.8; // 80%
let currentAbortController = null; // Track current request for cancellation
let isInThinkingMode = false; // Track if we're currently in thinking mode
let accumulatedThinking = ''; // Track thinking content for skip functionality

// Persistence functions
function saveToLocalStorage() {
    try {
        localStorage.setItem('mermaid-diagram', currentDiagram);
        localStorage.setItem('conversation-messages', JSON.stringify(conversationMessages));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

function saveMessageToStorage(role, content, type = 'normal') {
    const message = { role, content, type };
    conversationMessages.push(message);
    updateContextStatus();
    saveToLocalStorage();
}

function loadFromLocalStorage() {
    try {
        const savedDiagram = localStorage.getItem('mermaid-diagram');
        const savedMessages = localStorage.getItem('conversation-messages');
        
        if (savedDiagram) {
            currentDiagram = savedDiagram;
        }
        
        if (savedMessages) {
            conversationMessages = JSON.parse(savedMessages);
            // Rebuild chat UI from saved messages
            rebuildChatFromMessages();
        }
    } catch (error) {
        console.error('Error loading from localStorage:', error);
    }
}

function rebuildChatFromMessages() {
    const chatHistoryDiv = document.getElementById('chat-history');
    chatHistoryDiv.innerHTML = '';

    conversationMessages.forEach(msg => {
        if (msg.type === 'thinking') {
            // Parse thinking content from stored message
            const fullContent = msg.content;
            const thinkStart = fullContent.indexOf('<think>');
            const thinkEnd = fullContent.indexOf('</think>');

            let thinkingContent = '';
            let finalContent = fullContent;

            if (thinkStart !== -1 && thinkEnd !== -1) {
                thinkingContent = fullContent.substring(thinkStart + 7, thinkEnd);
                finalContent = fullContent.substring(0, thinkStart) + fullContent.substring(thinkEnd + 8);
            }

            // Create thinking message structure
            const thinkingDiv = document.createElement('div');
            thinkingDiv.className = 'message ai-message thinking-message';
            thinkingDiv.innerHTML = '<div class="thinking-header">🤔 Thinking... <span class="toggle-icon">▼</span></div><div class="thinking-content"></div>';

            const contentDiv = thinkingDiv.querySelector('.thinking-content');
            contentDiv.textContent = thinkingContent;

            // Add click handler to toggle thinking content
            const header = thinkingDiv.querySelector('.thinking-header');
            const toggleIcon = thinkingDiv.querySelector('.toggle-icon');
            let isCollapsed = false;

            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                isCollapsed = !isCollapsed;
                contentDiv.style.display = isCollapsed ? 'none' : 'block';
                toggleIcon.textContent = isCollapsed ? '▶' : '▼';
            });

            chatHistoryDiv.appendChild(thinkingDiv);

            // Add final content if it exists
            if (finalContent.trim()) {
                const finalDiv = document.createElement('div');
                finalDiv.className = 'message ai-message';
                finalDiv.textContent = finalContent.trim();
                chatHistoryDiv.appendChild(finalDiv);
            }
        } else if (msg.type === 'thinking-summary') {
            // Handle summarized thinking blocks
            const summaryMatch = msg.content.match(/<think-summary original="([^"]*)">(.*?)<\/think-summary>(.*)/);
            if (summaryMatch) {
                const originalContent = atob(summaryMatch[1]);
                const summaryContent = summaryMatch[2];
                const finalContent = summaryMatch[3];

                // Create summarized thinking message structure
                const thinkingDiv = document.createElement('div');
                thinkingDiv.className = 'message ai-message thinking-message';
                thinkingDiv.innerHTML = '<div class="thinking-header"><span style="color: #ff6b35;">📝 Summarized Thinking...</span> <span class="toggle-icon">▼</span></div><div class="thinking-content"></div>';

                const contentDiv = thinkingDiv.querySelector('.thinking-content');
                contentDiv.textContent = summaryContent;
                contentDiv.style.fontStyle = 'italic';
                contentDiv.style.color = '#666';

                // Add toggle button for original content
                const expandBtn = document.createElement('button');
                expandBtn.textContent = 'Show Original';
                expandBtn.style.marginTop = '5px';
                expandBtn.style.fontSize = '12px';
                expandBtn.style.padding = '2px 6px';
                expandBtn.onclick = () => {
                    if (expandBtn.textContent === 'Show Original') {
                        contentDiv.textContent = originalContent;
                        contentDiv.style.fontStyle = 'normal';
                        contentDiv.style.color = 'inherit';
                        expandBtn.textContent = 'Show Summary';
                    } else {
                        contentDiv.textContent = summaryContent;
                        contentDiv.style.fontStyle = 'italic';
                        contentDiv.style.color = '#666';
                        expandBtn.textContent = 'Show Original';
                    }
                };
                contentDiv.appendChild(expandBtn);

                // Add click handler to toggle thinking content
                const header = thinkingDiv.querySelector('.thinking-header');
                const toggleIcon = thinkingDiv.querySelector('.toggle-icon');
                let isCollapsed = false;

                header.style.cursor = 'pointer';
                header.addEventListener('click', () => {
                    isCollapsed = !isCollapsed;
                    contentDiv.style.display = isCollapsed ? 'none' : 'block';
                    toggleIcon.textContent = isCollapsed ? '▶' : '▼';
                });

                chatHistoryDiv.appendChild(thinkingDiv);

                // Add final content if it exists
                if (finalContent.trim()) {
                    const finalDiv = document.createElement('div');
                    finalDiv.className = 'message ai-message';
                    finalDiv.textContent = finalContent.trim();
                    chatHistoryDiv.appendChild(finalDiv);
                }
            }
        } else if (msg.role === 'tool') {
            // Tool result message
            const div = document.createElement('div');
            div.className = 'message tool-message';
            div.textContent = msg.content;
            chatHistoryDiv.appendChild(div);
        } else {
            // Normal message
            const div = document.createElement('div');
            div.className = `message ${msg.role}-message`;
            div.textContent = msg.content;
            chatHistoryDiv.appendChild(div);
        }
    });
}

function resetConversation() {
    if (confirm('Are you sure you want to reset the conversation and diagram? This cannot be undone.')) {
        currentDiagram = `graph TD\nA[Start] --> B[Process]\nB --> C[End]`;
        conversationMessages = [];

        const chatHistoryDiv = document.getElementById('chat-history');
        chatHistoryDiv.innerHTML = '';

        // Clear localStorage
        try {
            localStorage.removeItem('mermaid-diagram');
            localStorage.removeItem('conversation-messages');
        } catch (error) {
            console.error('Error clearing localStorage:', error);
        }

        renderDiagram();
        updateContextStatus();
    }
}

function estimateTokens(text) {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
}

function updateContextStatus() {
    const totalTokens = conversationMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    const percent = Math.round((totalTokens / MAX_CONTEXT_TOKENS) * 100);
    
    document.getElementById('token-count').textContent = totalTokens;
    document.getElementById('context-percent').textContent = percent + '%';
    
    // Change color when approaching limit
    const statusDiv = document.querySelector('.context-status');
    if (percent >= 90) {
        statusDiv.style.backgroundColor = '#ffebee';
        statusDiv.style.borderColor = '#ffcdd2';
        statusDiv.style.color = '#c62828';
    } else if (percent >= 80) {
        statusDiv.style.backgroundColor = '#fff3e0';
        statusDiv.style.borderColor = '#ffcc02';
        statusDiv.style.color = '#ef6c00';
    } else {
        statusDiv.style.backgroundColor = '#e3f2fd';
        statusDiv.style.borderColor = '#bbdefb';
        statusDiv.style.color = '#1976d2';
    }
}

async function summarizeThinkingBlocks() {
    // Find old thinking blocks in chat history and summarize them
    const thinkingElements = document.querySelectorAll('.thinking-message');
    if (thinkingElements.length < 2) return; // Keep at least one

    // Summarize the oldest thinking block
    const oldestThinking = thinkingElements[0];
    const content = oldestThinking.querySelector('.thinking-content').textContent;

    try {
        // Call LLM to summarize just the thinking content
        const summaryResponse = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen/qwen3-4b-thinking-2507',
                messages: [
                    { role: 'system', content: 'Provide a concise TLDR summary of the following thinking content in 1-2 sentences:' },
                    { role: 'user', content: content }
                ],
                stream: false
            })
        });

        const summaryData = await summaryResponse.json();
        const summary = summaryData.choices[0].message.content;

        // Find and update the corresponding message in conversationMessages
        let messageIndex = -1;
        for (let i = 0; i < conversationMessages.length; i++) {
            const msg = conversationMessages[i];
            if (msg.type === 'thinking') {
                // Extract thinking content from the stored message
                const thinkStart = msg.content.indexOf('<think>');
                const thinkEnd = msg.content.indexOf('</think>');
                if (thinkStart !== -1 && thinkEnd !== -1) {
                    const originalThinking = msg.content.substring(thinkStart + 7, thinkEnd);
                    // Check if this matches the content we're summarizing
                    if (originalThinking.trim() === content.trim()) {
                        messageIndex = i;
                        break;
                    }
                }
            }
        }

        if (messageIndex !== -1) {
            // Update the message to store both original and summarized thinking
            const oldMessage = conversationMessages[messageIndex];
            const finalContent = oldMessage.content.substring(oldMessage.content.indexOf('</think>') + 8);

            // Store the summarized version for context, but keep original for UI
            conversationMessages[messageIndex] = {
                role: oldMessage.role,
                content: `<think-summary original="${btoa(content)}">${summary}</think-summary>${finalContent}`,
                type: 'thinking-summary'
            };

            // Update the DOM to show summarized thinking block
            const header = oldestThinking.querySelector('.thinking-header');
            header.innerHTML = '<span style="color: #ff6b35;">📝 Summarized Thinking...</span> <span class="toggle-icon">▼</span>';

            const contentDiv = oldestThinking.querySelector('.thinking-content');
            contentDiv.textContent = summary;
            contentDiv.style.fontStyle = 'italic';
            contentDiv.style.color = '#666';

            // Add a button to expand to original
            const expandBtn = document.createElement('button');
            expandBtn.textContent = 'Show Original';
            expandBtn.style.marginTop = '5px';
            expandBtn.style.fontSize = '12px';
            expandBtn.style.padding = '2px 6px';
            expandBtn.onclick = () => {
                if (expandBtn.textContent === 'Show Original') {
                    contentDiv.textContent = content;
                    contentDiv.style.fontStyle = 'normal';
                    contentDiv.style.color = 'inherit';
                    expandBtn.textContent = 'Show Summary';
                } else {
                    contentDiv.textContent = summary;
                    contentDiv.style.fontStyle = 'italic';
                    contentDiv.style.color = '#666';
                    expandBtn.textContent = 'Show Original';
                }
            };
            contentDiv.appendChild(expandBtn);

            // Save to localStorage
            saveToLocalStorage();
        }

        updateContextStatus();

    } catch (error) {
        console.error('Error summarizing thinking block:', error);
    }
}

mermaid.initialize({ startOnLoad: false });

function renderDiagram() {
    const element = document.getElementById('diagram-container');
    element.innerHTML = '';
    mermaid.render('diagram', currentDiagram).then(({ svg }) => {
        element.innerHTML = svg;
        updateCodeTextarea();
    }).catch(err => {
        console.error('Mermaid render error:', err);
        element.innerHTML = '<p>Error rendering diagram</p>';
    });
}

function updateCodeTextarea() {
    const textarea = document.getElementById('code-textarea');
    textarea.value = currentDiagram;
}

function addMessage(role, content, type = 'normal') {
    const div = document.createElement('div');
    div.className = `message ${role}-message`;
    div.textContent = content;
    const chatHistory = document.getElementById('chat-history');
    chatHistory.appendChild(div);
    div.scrollIntoView({ behavior: 'smooth' });
    
    // Track message for context management
    saveMessageToStorage(role, content, type);
    
    // Check if we need to summarize
    const totalTokens = conversationMessages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
    if (totalTokens > MAX_CONTEXT_TOKENS * CONTEXT_WARNING_THRESHOLD) {
        summarizeThinkingBlocks();
    }
}

function executeTool(name, args) {
    switch (name) {
        case 'add_node':
            // Check if node with this ID already exists and replace it
            const nodeRegex = new RegExp(`\\n${args.id}\\[.*?\\]`, 'g');
            if (currentDiagram.match(nodeRegex)) {
                // Replace existing node
                currentDiagram = currentDiagram.replace(nodeRegex, `\n${args.id}[${args.label}]`);
            } else {
                // Add new node
                currentDiagram += `\n${args.id}[${args.label}]`;
            }
            break;
        case 'remove_node':
            const removeNodeRegex = new RegExp(`\\n${args.id}\\[.*?\\]`, 'g');
            currentDiagram = currentDiagram.replace(removeNodeRegex, '');
            break;
        case 'add_edge':
            const edgeLabel = args.label ? `|${args.label}|` : '';
            currentDiagram += `\n${args.from} -->${edgeLabel} ${args.to}`;
            break;
        case 'remove_edge':
            const edgeRegex = new RegExp(`\\n${args.from} -->.*? ${args.to}`, 'g');
            currentDiagram = currentDiagram.replace(edgeRegex, '');
            break;
        case 'modify_node_label':
            const labelRegex = new RegExp(`(${args.id})\\[(.*?)\\]`, 'g');
            currentDiagram = currentDiagram.replace(labelRegex, `$1[${args.new_label}]`);
            break;
        case 'modify_edge_label':
            const edgeLabelRegex = new RegExp(`(${args.from} -->)\\|(.*?)\\| (${args.to})`, 'g');
            currentDiagram = currentDiagram.replace(edgeLabelRegex, `$1|${args.new_label}| $3`);
            break;
    }
    saveToLocalStorage();
}

async function callLLM(messages) {
    // Create abort controller for this request
    currentAbortController = new AbortController();
    const stopBtn = document.getElementById('stop-btn');
    stopBtn.style.display = 'block';

    const tools = [
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
                name: 'remove_node',
                description: 'Remove a node from the flowchart',
                parameters: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Node ID to remove' }
                    },
                    required: ['id']
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
        },
        {
            type: 'function',
            function: {
                name: 'remove_edge',
                description: 'Remove an edge between two nodes',
                parameters: {
                    type: 'object',
                    properties: {
                        from: { type: 'string', description: 'Source node ID' },
                        to: { type: 'string', description: 'Target node ID' }
                    },
                    required: ['from', 'to']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'modify_node_label',
                description: 'Change the label of a node',
                parameters: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', description: 'Node ID' },
                        new_label: { type: 'string', description: 'New label' }
                    },
                    required: ['id', 'new_label']
                }
            }
        },
        {
            type: 'function',
            function: {
                name: 'modify_edge_label',
                description: 'Change the label of an edge',
                parameters: {
                    type: 'object',
                    properties: {
                        from: { type: 'string', description: 'Source node ID' },
                        to: { type: 'string', description: 'Target node ID' },
                        new_label: { type: 'string', description: 'New label' }
                    },
                    required: ['from', 'to', 'new_label']
                }
            }
        }
    ];

    try {
        const response = await fetch('http://localhost:1234/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'qwen/qwen3-4b-thinking-2507',
                messages: messages,
                tools: tools,
                tool_choice: 'auto',
                stream: true
            }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let thinkingContent = '';
        let finalContent = '';
        let toolCalls = [];
        let currentToolCall = null;
        let isThinking = false;
        let isFinal = false;

        const thinkingDiv = document.createElement('div');
        thinkingDiv.className = 'message ai-message thinking-message';
        thinkingDiv.innerHTML = '<div class="thinking-header">🤔 Thinking... <span class="toggle-icon">▼</span></div><div class="thinking-content"></div>';
        const chatHistory = document.getElementById('chat-history');
        chatHistory.appendChild(thinkingDiv);
        thinkingDiv.scrollIntoView({ behavior: 'smooth' });

        // Add click handler to toggle thinking content
        const header = thinkingDiv.querySelector('.thinking-header');
        const content = thinkingDiv.querySelector('.thinking-content');
        const toggleIcon = thinkingDiv.querySelector('.toggle-icon');
        let isCollapsed = false;

        header.style.cursor = 'pointer';
        header.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            content.style.display = isCollapsed ? 'none' : 'block';
            toggleIcon.textContent = isCollapsed ? '▶' : '▼';
        });

        const finalDiv = document.createElement('div');
        finalDiv.className = 'message ai-message';
        finalDiv.style.display = 'none';
        document.getElementById('chat-history').appendChild(finalDiv);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices[0].delta;

                        if (delta.content) {
                            const content = delta.content;
                            if (content.includes('<think>')) {
                                isThinking = true;
                                isFinal = false;
                            } else if (content.includes('</think>')) {
                                isThinking = false;
                                isFinal = true;
                            }

                            if (isThinking && !isFinal) {
                                isInThinkingMode = true;
                                const skipBtn = document.getElementById('skip-thinking-btn');
                                skipBtn.style.display = 'block';

                                thinkingContent += content.replace('<think>', '').replace('</think>', '');
                                accumulatedThinking = thinkingContent; // Track for skip functionality
                                thinkingDiv.querySelector('.thinking-content').textContent = thinkingContent;
                                chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
                            } else if (isFinal || (!isThinking && !content.includes('<think>'))) {
                                isInThinkingMode = false;
                                const skipBtn = document.getElementById('skip-thinking-btn');
                                skipBtn.style.display = 'none';

                                finalContent += content.replace('<think>', '').replace('</think>', '');
                                finalDiv.textContent = finalContent;
                                finalDiv.style.display = 'block';
                                chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
                            }
                        }

                        if (delta.tool_calls) {
                            for (const toolCall of delta.tool_calls) {
                                if (toolCall.index !== undefined) {
                                    if (!toolCalls[toolCall.index]) {
                                        toolCalls[toolCall.index] = { id: '', function: { name: '', arguments: '' } };
                                    }
                                    if (toolCall.id) toolCalls[toolCall.index].id += toolCall.id;
                                    if (toolCall.function) {
                                        if (toolCall.function.name) toolCalls[toolCall.index].function.name += toolCall.function.name;
                                        if (toolCall.function.arguments) toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing SSE data:', e);
                    }
                }
            }
        }

        // Remove thinking div if no thinking content
        if (!thinkingContent.trim()) {
            thinkingDiv.remove();
        } else {
            // Track thinking content for context management
            // Save the complete message with thinking tags for proper reconstruction
            // Make sure finalContent doesn't contain any thinking tags
            const cleanFinalContent = finalContent.replace(/<think>.*?<\/think>/gs, '').trim();
            const completeContent = `<think>${thinkingContent}</think>${cleanFinalContent}`;
            saveMessageToStorage('assistant', completeContent, 'thinking');
        }

        // Execute tool calls and continue the loop
        if (toolCalls.length > 0) {
            const toolMessages = [];
            const toolDescriptions = [];

            // Show tool calls in chat
            for (const toolCall of toolCalls) {
                if (toolCall && toolCall.function.name) {
                    const args = JSON.parse(toolCall.function.arguments);
                    const toolDesc = `${toolCall.function.name}(${Object.values(args).join(', ')})`;

                    // Display tool call in chat
                    const toolCallDiv = document.createElement('div');
                    toolCallDiv.className = 'message ai-message tool-call';
                    toolCallDiv.textContent = `🔧 Calling tool: ${toolDesc}`;
                    document.getElementById('chat-history').appendChild(toolCallDiv);
                    conversationMessages.push({ role: 'assistant', content: `🔧 Calling tool: ${toolDesc}` });

                    const result = executeTool(toolCall.function.name, args);

                    // Display tool result in chat
                    const toolResultDiv = document.createElement('div');
                    toolResultDiv.className = 'message tool-message';
                    toolResultDiv.textContent = `✅ Tool result: ${toolCall.function.name} executed successfully`;
                    document.getElementById('chat-history').appendChild(toolResultDiv);
                    conversationMessages.push({ role: 'tool', content: `✅ Tool result: ${toolCall.function.name} executed successfully` });

                    toolMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: `Tool executed successfully: ${toolDesc}`
                    });
                    toolDescriptions.push(toolDesc);
                }
            }
            renderDiagram();

            // Continue the agentic loop with tool results
            const newMessages = [...messages, ...toolMessages];
            return await callLLM(newMessages);
        }

        // If no final content and no tools, add a default message
        if (!finalContent.trim() && toolCalls.length === 0) {
            finalDiv.textContent = 'I\'ve processed your request.';
            finalDiv.style.display = 'block';
            conversationMessages.push({ role: 'assistant', content: 'I\'ve processed your request.' });
        } else if (finalContent.trim()) {
            conversationMessages.push({ role: 'assistant', content: finalContent });
        }

        updateContextStatus();
        saveToLocalStorage();

    } catch (error) {
        console.error('Error calling LLM:', error);
        if (error.name === 'AbortError') {
            addMessage('ai', 'Request cancelled by user.');
        } else {
            addMessage('ai', 'Error: Could not connect to LMStudio. Make sure it is running on localhost:1234.');
        }
        const sendBtn = document.getElementById('send-btn');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    } finally {
        // Clean up abort controller and hide stop button
        currentAbortController = null;
        const stopBtn = document.getElementById('stop-btn');
        stopBtn.style.display = 'none';
    }
}

/**
 * Converts chat messages to LLM API format, including conversation history
 * @param {string} currentUserMessage - The new user message to add
 * @returns {LLMMessage[]} Messages formatted for LLM API
 */
function buildLLMMessages(currentUserMessage) {
    const systemMessage = `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nYour role is to help users refine and modify Mermaid diagrams using the available tools. When a user makes a request:

1. If the request is clear and specific, use the appropriate tools to modify the diagram.
2. If the request is ambiguous, vague, or lacks specific details, provide 2-3 specific clarification options for the user to choose from, numbered 1, 2, 3, etc.
3. When a user responds with just a number (like "1", "2", "3"), interpret it as selecting that numbered option from your previous clarification message.
4. Limit clarification attempts to a maximum of 2 per conversation. After 2 clarification attempts, make reasonable assumptions and proceed with the most logical interpretation.
5. Always explain what changes you're making when using tools.
6. If no diagram modifications are needed, respond naturally to the user's message.
7. Keep your thinking concise and focused - avoid over-analyzing simple requests.

Remember: When users respond with numbers, they are selecting from your previous numbered options. Be efficient and provide clear options when clarification is needed.`;

    const messages = [{ role: 'system', content: systemMessage }];

    // Add conversation history (excluding system messages and tool messages for now)
    conversationMessages.forEach(chatMsg => {
        if (chatMsg.role !== 'system' && chatMsg.role !== 'tool') {
            let content = chatMsg.content;

            // For summarized thinking, extract just the summary part for context
            if (chatMsg.type === 'thinking-summary') {
                const summaryMatch = content.match(/<think-summary original="[^"]*">(.*?)<\/think-summary>(.*)/);
                if (summaryMatch) {
                    // Send only the summary + final content to context
                    content = `<think>${summaryMatch[1]}</think>${summaryMatch[2]}`;
                }
            }

            messages.push({
                role: chatMsg.role,
                content: content
            });
        }
    });

    // Add the current user message
    messages.push({ role: 'user', content: currentUserMessage });

    return messages;
}

async function startConversation(message) {
    const messages = buildLLMMessages(message);
    await callLLM(messages);
}

document.getElementById('send-btn').addEventListener('click', async () => {
    const input = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const message = input.value.trim();
    if (message) {
        addMessage('user', message);
        input.value = '';
        sendBtn.disabled = true;
        sendBtn.textContent = 'Thinking...';
        await startConversation(message);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
});

document.getElementById('user-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('send-btn').click();
    }
});

// Initial render
renderDiagram();

// Manual summarize button
document.getElementById('summarize-btn').addEventListener('click', async () => {
    const btn = document.getElementById('summarize-btn');
    btn.disabled = true;
    btn.textContent = '⏳';
    await summarizeThinkingBlocks();
    btn.disabled = false;
    btn.textContent = '📝';
});

// Reset button
document.getElementById('reset-btn').addEventListener('click', resetConversation);

// Stop button
document.getElementById('stop-btn').addEventListener('click', () => {
    if (currentAbortController) {
        currentAbortController.abort();
        const sendBtn = document.getElementById('send-btn');
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
});

// Skip thinking button
document.getElementById('skip-thinking-btn').addEventListener('click', async () => {
    if (currentAbortController && isInThinkingMode && accumulatedThinking.trim()) {
        // Cancel current request
        currentAbortController.abort();

        // Create a new assistant message that "completes" the thinking with </think> tag
        const completedThinkingMessage = `<think>${accumulatedThinking}</think>`;
        saveMessageToStorage('assistant', completedThinkingMessage, 'thinking');

        // Update the UI to show the completed thinking
        const thinkingDivs = document.querySelectorAll('.thinking-message');
        if (thinkingDivs.length > 0) {
            const lastThinkingDiv = thinkingDivs[thinkingDivs.length - 1];
            const finalDiv = document.createElement('div');
            finalDiv.className = 'message ai-message';
            finalDiv.textContent = 'Continuing with response...';
            document.getElementById('chat-history').appendChild(finalDiv);
            conversationMessages.push({ role: 'assistant', content: 'Continuing with response...' });
        }

        const sendBtn = document.getElementById('send-btn');
        sendBtn.disabled = true;
        sendBtn.textContent = 'Responding...';

        // Build messages for continuation - include the completed thinking
        const systemMessage = `You are a Mermaid diagram refiner. The current diagram code is:\n\`\`\`mermaid\n${currentDiagram}\n\`\`\`\n\nYour role is to help users refine and modify Mermaid diagrams using the available tools. When a user makes a request:

1. If the request is clear and specific, use the appropriate tools to modify the diagram.
2. If the request is ambiguous, vague, or lacks specific details, provide 2-3 specific clarification options for the user to choose from, numbered 1, 2, 3, etc.
3. When a user responds with just a number (like "1", "2", "3"), interpret it as selecting that numbered option from your previous clarification message.
4. Limit clarification attempts to a maximum of 2 per conversation. After 2 clarification attempts, make reasonable assumptions and proceed with the most logical interpretation.
5. Always explain what changes you're making when using tools.
6. If no diagram modifications are needed, respond naturally to the user's message.
7. Keep your thinking concise and focused - avoid over-analyzing simple requests.

Remember: When users respond with numbers, they are selecting from your previous numbered options. Be efficient and provide clear options when clarification is needed.`;

        const messages = [{ role: 'system', content: systemMessage }];

        // Add conversation history (excluding system messages and tool messages)
        conversationMessages.forEach(chatMsg => {
            if (chatMsg.role !== 'system' && chatMsg.role !== 'tool') {
                messages.push({
                    role: chatMsg.role,
                    content: chatMsg.content
                });
            }
        });

        // Add a continuation prompt that explicitly prevents thinking
        messages.push({
            role: 'user',
            content: 'IMPORTANT: You have already completed your thinking phase above. DO NOT use <think> tags again. Now provide your final response or use tools as needed. Be direct and concise.'
        });

        await callLLM(messages);
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
    }
});

// Load saved data on page load
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();
    renderDiagram();
    updateContextStatus();
});
