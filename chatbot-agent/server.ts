import express from 'express';
import multer from 'multer';
import axios from 'axios';
import cors from 'cors';
import fs from 'fs';
import path from 'path';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

// Multer for image uploads
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// LMStudio API endpoint (assuming local server)
const LMSTUDIO_URL = 'http://localhost:1234/v1/chat/completions'; // Adjust if different

// Context storage (in-memory for simplicity)
let conversationHistory: any[] = [];

// Tool definitions
const tools = [
  {
    type: 'function',
    function: {
      name: 'make_rest_call',
      description: 'Make a generic REST API call',
      parameters: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
          url: { type: 'string' },
          headers: { type: 'object' },
          body: { type: 'object' }
        },
        required: ['method', 'url']
      }
    }
  }
];

// Function to call LMStudio
async function callLMStudio(messages: any[], tools?: any[]): Promise<any> {
  try {
    const payload: any = {
      model: 'google/gemma-3-4b', // Specify the model
      messages: messages,
      max_tokens: 1000,
      temperature: 0.7
    };
    if (tools) payload.tools = tools;

    const response = await axios.post(LMSTUDIO_URL, payload);
    return response.data.choices[0].message;
  } catch (error) {
    console.error('Error calling LMStudio:', error);
    return { content: 'Error communicating with LMStudio.' };
  }
}

// Function to execute tool
async function executeTool(toolCall: any): Promise<any> {
  const { name, arguments: args } = toolCall;
  if (name === 'make_rest_call') {
    try {
      const { method, url, headers = {}, body } = args;
      const config: any = { method, url, headers };
      if (body) config.data = body;
      const response = await axios(config);
      return response.data;
    } catch (error) {
      return { error: (error as Error).message };
    }
  }
  return { error: 'Unknown tool' };
}

// Chat endpoint
app.post('/chat', async (req: express.Request, res: express.Response) => {
  const { message, base64Image } = req.body;

  // Add user message to history
  if (base64Image) {
    conversationHistory.push({
      role: 'user',
      content: [
        { type: 'text', text: message },
        { type: 'image_url', image_url: { url: base64Image } }
      ]
    });
  } else {
    conversationHistory.push({ role: 'user', content: message });
  }

  // Call LMStudio
  const response = await callLMStudio(conversationHistory, tools);

  // Check for tool calls
  if (response.tool_calls) {
    for (const toolCall of response.tool_calls) {
      const toolResult = await executeTool(toolCall);
      conversationHistory.push({ role: 'assistant', content: response.content, tool_calls: response.tool_calls });
      conversationHistory.push({ role: 'tool', content: JSON.stringify(toolResult), tool_call_id: toolCall.id });
    }
    // Get final response after tool execution
    const finalResponse = await callLMStudio(conversationHistory);
    conversationHistory.push({ role: 'assistant', content: finalResponse.content });
    res.json({ response: finalResponse.content });
  } else {
    conversationHistory.push({ role: 'assistant', content: response.content });
    res.json({ response: response.content });
  }
});

// Image upload endpoint
app.post('/upload', upload.single('image'), (req: express.Request, res: express.Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Read the file and convert to base64
  const imagePath = req.file.path;
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = req.file.mimetype;

  // Clean up the uploaded file
  fs.unlinkSync(imagePath);

  res.json({ base64Image: `data:${mimeType};base64,${base64Image}` });
});

// Serve uploaded images
app.use('/uploads', express.static('uploads'));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
