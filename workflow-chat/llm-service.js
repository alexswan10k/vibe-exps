/**
 * LLM Service for Workflow Chat
 * Handles AI interactions for workflow completion using LMStudio or OpenRouter
 */

const LLMService = {
    /**
     * Send a message to the LLM and handle tool calling
     * @param {Array} messages - Conversation messages
     * @param {Object} config - LLM configuration
     * @param {Array} tools - Available tools
     * @returns {Promise<Object>} Response with success/error
     */
    async sendMessage(messages, config, tools = []) {
        try {
            const { provider, lmStudioEndpoint, lmStudioModel, openRouterApiKey, openRouterModel } = config;

            let endpoint, headers, model;

            if (provider === 'openRouter') {
                endpoint = 'https://openrouter.ai/api/v1/chat/completions';
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'HTTP-Referer': window.location.origin,
                    'X-Title': 'Workflow Chat'
                };
                model = openRouterModel;
            } else {
                endpoint = `${lmStudioEndpoint}/v1/chat/completions`;
                headers = {
                    'Content-Type': 'application/json',
                };
                model = lmStudioModel;
            }

            const requestBody = {
                model,
                messages,
                stream: true // Enable streaming for real-time responses
            };

            // Add tools if provided
            if (tools.length > 0) {
                requestBody.tools = tools;
                requestBody.tool_choice = 'auto';
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return { success: true, response };

        } catch (error) {
            console.error('LLM service error:', error);
            // Check if it's a CORS error
            if (error.message.includes('CORS') || error.message.includes('Access-Control')) {
                return {
                    success: false,
                    error: 'CORS Error: Please run the workflow chat through a local web server. Try: python -m http.server 8000'
                };
            }
            return { success: false, error: error.message };
        }
    },

    /**
     * Process streaming response from LLM
     * @param {Response} response - Fetch response object
     * @param {Function} onChunk - Callback for each chunk received
     * @param {Function} onComplete - Callback when streaming is complete
     * @param {Function} onError - Callback for errors
     * @param {Function} onToolCall - Callback when tool calls are detected during streaming
     */
    async processStreamingResponse(response, onChunk, onComplete, onError, onToolCall) {
        try {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let accumulatedContent = '';
            let toolCalls = [];
            let currentToolCall = null;
            let isThinking = false;
            let thinkingContent = '';

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

                            // Handle content streaming
                            if (delta.content) {
                                const content = delta.content;

                                // Always accumulate raw content with tags for proper parsing
                                accumulatedContent += content;

                                // Determine current thinking state by counting tags in accumulated content
                                const thinkOpenCount = (accumulatedContent.match(/<think>/g) || []).length;
                                const thinkCloseCount = (accumulatedContent.match(/<\/think>/g) || []).length;
                                isThinking = thinkOpenCount > thinkCloseCount;

                                // Extract thinking content for legacy compatibility (though not used in current UI)
                                if (isThinking) {
                                    const lastThinkStart = accumulatedContent.lastIndexOf('<think>');
                                    if (lastThinkStart !== -1) {
                                        thinkingContent = accumulatedContent.substring(lastThinkStart + 7).replace(/<\/think>.*$/, '');
                                    }
                                }

                                onChunk({
                                    content: delta.content,
                                    accumulatedContent,
                                    thinkingContent,
                                    isThinking
                                });
                            }

                            // Handle tool calls
                            if (delta.tool_calls) {
                                let hasNewToolCalls = false;
                                for (const toolCall of delta.tool_calls) {
                                    if (toolCall.index !== undefined) {
                                        if (!toolCalls[toolCall.index]) {
                                            toolCalls[toolCall.index] = { id: '', function: { name: '', arguments: '' } };
                                            hasNewToolCalls = true;
                                        }
                                        if (toolCall.id) toolCalls[toolCall.index].id += toolCall.id;
                                        if (toolCall.function) {
                                            if (toolCall.function.name) toolCalls[toolCall.index].function.name += toolCall.function.name;
                                            if (toolCall.function.arguments) toolCalls[toolCall.index].function.arguments += toolCall.function.arguments;
                                        }
                                    }
                                }
                                // Notify when tool calls are first detected
                                if (hasNewToolCalls && onToolCall) {
                                    onToolCall(toolCalls);
                                }
                            }
                        } catch (e) {
                            console.error('Error parsing streaming data:', e);
                        }
                    }
                }
            }

            onComplete({
                content: accumulatedContent,
                thinkingContent,
                toolCalls
            });

        } catch (error) {
            console.error('Streaming error:', error);
            onError(error);
        }
    },

    /**
     * Check if LLM configuration is valid
     * @param {Object} config - LLM configuration
     * @returns {boolean} True if configuration is valid
     */
    isConfigured(config) {
        if (config.provider === 'lmStudio') {
            return config.lmStudioEndpoint.trim() !== '' && config.lmStudioModel.trim() !== '';
        } else if (config.provider === 'openRouter') {
            return config.openRouterApiKey.trim() !== '' && config.openRouterModel.trim() !== '';
        }
        return false;
    },

    /**
     * Get default LLM configuration
     * @returns {Object} Default configuration
     */
    getDefaultConfig() {
        return {
            provider: 'lmStudio',
            lmStudioEndpoint: 'http://localhost:1234',
            lmStudioModel: 'qwen/qwen3-4b-thinking-2507',
            openRouterApiKey: '',
            openRouterModel: ''
        };
    }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LLMService;
} else {
    window.LLMService = LLMService;
}
