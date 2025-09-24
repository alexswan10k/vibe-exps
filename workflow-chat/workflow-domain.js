/**
 * Workflow Domain Logic
 * Handles workflow parameter parsing, validation, and completion logic
 */

const WorkflowDomain = {
    /**
     * Parse URL parameters and decode base64 encoded values
     * @param {URLSearchParams} searchParams - URL search parameters
     * @returns {Object} Parsed workflow parameters
     */
    parseWorkflowParameters(searchParams) {
        const prompt = searchParams.get('prompt');
        const schema = searchParams.get('schema');
        const returnUrl = searchParams.get('returnUrl');

        return {
            prompt: prompt ? this.decodeBase64(prompt) : null,
            schema: schema ? JSON.parse(this.decodeBase64(schema)) : null,
            returnUrl: returnUrl || null
        };
    },

    /**
     * Decode base64 string safely
     * @param {string} base64String - Base64 encoded string
     * @returns {string} Decoded string
     */
    decodeBase64(base64String) {
        try {
            return atob(base64String);
        } catch (error) {
            console.error('Error decoding base64:', error);
            throw new Error('Invalid base64 encoding in URL parameters');
        }
    },

    /**
     * Validate workflow parameters
     * @param {Object} params - Workflow parameters
     * @returns {Object} Validation result
     */
    validateWorkflowParameters(params) {
        const errors = [];

        if (!params.prompt || typeof params.prompt !== 'string' || params.prompt.trim() === '') {
            errors.push('Prompt is required and must be a non-empty string');
        }

        if (!params.schema || typeof params.schema !== 'object') {
            errors.push('Schema is required and must be a valid JSON object');
        }

        if (!params.returnUrl || typeof params.returnUrl !== 'string' || params.returnUrl.trim() === '') {
            errors.push('Return URL is required and must be a non-empty string');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    /**
     * Validate payload against schema
     * @param {Object} payload - Workflow payload
     * @param {Object} schema - JSON schema
     * @returns {Object} Validation result
     */
    validatePayload(payload, schema) {
        const errors = [];

        // Basic validation - check required properties
        if (schema.required) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in payload)) {
                    errors.push(`Required property '${requiredProp}' is missing`);
                }
            }
        }

        // Type validation for properties that exist
        if (schema.properties) {
            for (const [prop, propSchema] of Object.entries(schema.properties)) {
                if (prop in payload) {
                    const value = payload[prop];
                    const expectedType = propSchema.type;

                    if (expectedType) {
                        if (expectedType === 'array') {
                            if (!Array.isArray(value)) {
                                errors.push(`Property '${prop}' must be an array, got '${typeof value}'`);
                            } else {
                                // Validate array items if schema is defined
                                if (propSchema.items) {
                                    for (let i = 0; i < value.length; i++) {
                                        const itemErrors = this.validateObjectAgainstSchema(value[i], propSchema.items, `${prop}[${i}]`);
                                        errors.push(...itemErrors);
                                    }
                                }
                            }
                        } else if (expectedType === 'object') {
                            if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                                errors.push(`Property '${prop}' must be an object, got '${typeof value}'`);
                            } else {
                                // Validate nested object
                                const nestedErrors = this.validateObjectAgainstSchema(value, propSchema, prop);
                                errors.push(...nestedErrors);
                            }
                        } else if (expectedType === 'string') {
                            if (typeof value !== 'string') {
                                errors.push(`Property '${prop}' must be a string, got '${typeof value}'`);
                            }
                        } else if (expectedType === 'number') {
                            if (typeof value !== 'number' || isNaN(value)) {
                                errors.push(`Property '${prop}' must be a number, got '${typeof value}'`);
                            }
                        } else if (expectedType === 'boolean') {
                            if (typeof value !== 'boolean') {
                                errors.push(`Property '${prop}' must be a boolean, got '${typeof value}'`);
                            }
                        }
                    }

                    // Check enum values
                    if (propSchema.enum && propSchema.enum.length > 0) {
                        if (!propSchema.enum.includes(value)) {
                            errors.push(`Property '${prop}' must be one of: ${propSchema.enum.join(', ')}, got '${value}'`);
                        }
                    }
                }
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    /**
     * Validate an object against a schema (helper for nested validation)
     * @param {Object} obj - Object to validate
     * @param {Object} schema - Schema to validate against
     * @param {string} path - Path for error messages
     * @returns {Array} Array of error messages
     */
    validateObjectAgainstSchema(obj, schema, path = '') {
        const errors = [];

        if (schema.required) {
            for (const requiredProp of schema.required) {
                if (!(requiredProp in obj)) {
                    errors.push(`Required property '${path ? path + '.' : ''}${requiredProp}' is missing`);
                }
            }
        }

        if (schema.properties) {
            for (const [prop, propSchema] of Object.entries(schema.properties)) {
                if (prop in obj) {
                    const value = obj[prop];
                    const expectedType = propSchema.type;
                    const propPath = path ? `${path}.${prop}` : prop;

                    if (expectedType) {
                        if (expectedType === 'array') {
                            if (!Array.isArray(value)) {
                                errors.push(`Property '${propPath}' must be an array, got '${typeof value}'`);
                            }
                        } else if (expectedType === 'object') {
                            if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                                errors.push(`Property '${propPath}' must be an object, got '${typeof value}'`);
                            }
                        } else if (expectedType === 'string') {
                            if (typeof value !== 'string') {
                                errors.push(`Property '${propPath}' must be a string, got '${typeof value}'`);
                            }
                        } else if (expectedType === 'number') {
                            if (typeof value !== 'number' || isNaN(value)) {
                                errors.push(`Property '${propPath}' must be a number, got '${typeof value}'`);
                            }
                        } else if (expectedType === 'boolean') {
                            if (typeof value !== 'boolean') {
                                errors.push(`Property '${propPath}' must be a boolean, got '${typeof value}'`);
                            }
                        }
                    }

                    // Check enum values
                    if (propSchema.enum && propSchema.enum.length > 0) {
                        if (!propSchema.enum.includes(value)) {
                            errors.push(`Property '${propPath}' must be one of: ${propSchema.enum.join(', ')}, got '${value}'`);
                        }
                    }
                }
            }
        }

        return errors;
    },

    /**
     * Generate system prompt for workflow completion
     * @param {string} userPrompt - The workflow prompt
     * @param {Object} schema - JSON schema for the expected payload
     * @returns {string} System prompt
     */
    generateSystemPrompt(userPrompt, schema) {
        const schemaStr = JSON.stringify(schema, null, 2);

        return `You are an interactive workflow assistant. Your goal is to help the user complete a specific task by gathering all necessary information and then calling the "complete" tool with the final result.

WORKFLOW CONTEXT:
${userPrompt}

EXPECTED OUTPUT SCHEMA:
${schemaStr}

INSTRUCTIONS:
1. Engage in natural conversation with the user to gather all required information
2. Ask clarifying questions when details are missing or ambiguous
3. Be helpful and guide the user through the process
4. When you have all the information needed to complete the workflow, call the "complete" tool with a payload that matches the expected schema
5. The payload should contain only the data specified in the schema - no extra fields
6. If the user provides incomplete or invalid information, ask for clarification rather than making assumptions

TOOL USAGE:
- Use the "complete" tool ONLY when you have gathered all required information
- The "complete" tool will redirect the user back to the originating application with the workflow result
- Do not call "complete" prematurely - ensure all required schema fields are populated

Remember: Your role is to facilitate the completion of this specific workflow through interactive conversation.`;
    },

    /**
     * Create the complete tool definition
     * @param {Object} schema - JSON schema for validation
     * @returns {Object} Tool definition
     */
    createCompleteTool(schema) {
        return {
            type: 'function',
            function: {
                name: 'complete',
                description: 'Complete the workflow by providing the final payload that matches the expected schema. Only call this when all required information has been gathered.',
                parameters: {
                    type: 'object',
                    properties: {
                        payload: schema
                    },
                    required: ['payload']
                }
            }
        };
    },

    /**
     * Handle workflow completion
     * @param {Object} payload - Workflow payload
     * @param {string} returnUrl - URL to redirect to
     * @param {Object} metadata - Additional metadata (scenario, validation status, etc.)
     */
    completeWorkflow(payload, returnUrl, metadata = {}) {
        const result = {
            payload,
            metadata: {
                scenario: metadata.scenario || 'custom',
                timestamp: new Date().toISOString(),
                schemaValidation: metadata.schemaValidation || { isValid: true, errors: [] },
                prompt: metadata.prompt || '',
                ...metadata
            }
        };

        const encodedPayload = btoa(JSON.stringify(result));
        const separator = returnUrl.includes('?') ? '&' : '?';
        const finalUrl = `${returnUrl}${separator}payload=${encodedPayload}`;

        // Use replace to avoid adding to browser history
        window.location.replace(finalUrl);
    }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WorkflowDomain;
} else {
    window.WorkflowDomain = WorkflowDomain;
}
