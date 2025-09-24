# Workflow Chat

Interactive LLM-powered chat interface for structured workflow completion.

## Integration

### Function Signature
```javascript
launchWorkflowChat(prompt: string, schema: object, returnUrl: string) -> void
```

### Launch Workflow (5 lines)
```javascript
const params = new URLSearchParams({
    prompt: btoa(prompt),
    schema: btoa(JSON.stringify(schema)),
    returnUrl: returnUrl
});
window.location.href = `workflow-chat/index.html?${params}`;
```

### Handle Result
```javascript
// On return, URL contains: ?payload=<base64-encoded-result>
const payload = new URLSearchParams(window.location.search).get('payload');
if (payload) {
    const result = JSON.parse(atob(payload));
    // result.payload = your structured data
    handleWorkflowResult(result.payload);
}
```

## Parameters

| Parameter | Type | Encoding | Description |
|-----------|------|----------|-------------|
| `prompt` | string | base64 | Workflow instructions for LLM |
| `schema` | object | base64 JSON | Expected output structure |
| `returnUrl` | string | none | Redirect destination |

## Configuration

Supports LMStudio (localhost:1234) and OpenRouter. Configure via localStorage or URL params.

## Testing

Open `test.html` for interactive testing with pre-built workflows.

## Example

```javascript
// Recipe creation workflow
const prompt = "Create a recipe with name, ingredients, and instructions";
const schema = {
    type: "object",
    properties: {
        name: { type: "string" },
        ingredients: { type: "array" },
        method: { type: "array" }
    },
    required: ["name", "ingredients"]
};

const params = new URLSearchParams({
    prompt: btoa(prompt),
    schema: btoa(JSON.stringify(schema)),
    returnUrl: window.location.href
});
window.location.href = `workflow-chat/index.html?${params}`;
```
