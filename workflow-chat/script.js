/**
 * Workflow Chat Application Script
 * Initializes and runs the workflow chat application
 */

// Initialize the workflow chat
function initWorkflowChat() {
    try {
        // Parse URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const workflowParams = WorkflowDomain.parseWorkflowParameters(urlParams);

        // Validate parameters
        const validation = WorkflowDomain.validateWorkflowParameters(workflowParams);
        if (!validation.isValid) {
            showError(`Invalid workflow parameters: ${validation.errors.join(', ')}`);
            return;
        }

        // Get LLM configuration from URL or use defaults
        let llmConfig;
        const llmConfigParam = urlParams.get('llmConfig');
        if (llmConfigParam) {
            try {
                llmConfig = JSON.parse(atob(llmConfigParam));
            } catch (error) {
                console.warn('Failed to parse LLM config from URL, using defaults:', error);
                llmConfig = LLMService.getDefaultConfig();
            }
        } else {
            llmConfig = LLMService.getDefaultConfig();
        }

        // Check if LLM is configured
        if (!LLMService.isConfigured(llmConfig)) {
            showError('LLM service is not configured. Please check your settings.');
            return;
        }

        // Render the workflow chat
        ReactDOM.render(
            React.createElement(WorkflowChat, {
                workflowParams,
                llmConfig,
                onComplete: (payload) => {
                    console.log('Workflow completed with payload:', payload);
                }
            }),
            document.getElementById('workflow-chat-root')
        );

    } catch (error) {
        console.error('Error initializing workflow chat:', error);
        showError(`Failed to initialize workflow chat: ${error.message}`);
    }
}

function showError(message) {
    document.getElementById('workflow-chat-root').innerHTML = `
        <div class="error-page">
            <h1>⚠️ Workflow Chat Error</h1>
            <p>${message}</p>
            <div class="error-details">
                <h3>Expected URL Parameters:</h3>
                <ul>
                    <li><code>prompt</code> - Base64 encoded workflow description</li>
                    <li><code>schema</code> - Base64 encoded JSON schema for the expected payload</li>
                    <li><code>returnUrl</code> - URL to redirect to after completion</li>
                </ul>
                <h3>Example:</h3>
                <code>?prompt=eyJDcmVhdGUgYSByZWNpcGUi}&schema=eyJuYW1lIjoic3RyaW5nIn0&returnUrl=/meal-planner</code>
            </div>
            <button onclick="window.history.back()">← Go Back</button>
        </div>
    `;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkflowChat);
} else {
    initWorkflowChat();
}
