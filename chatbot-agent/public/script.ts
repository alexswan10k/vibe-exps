interface ChatResponse {
  response: string;
}

interface UploadResponse {
  base64Image: string;
}

interface Tool {
  name: string;
  description: string;
  parameters: any;
}

interface CustomTool {
  name: string;
  endpoint: string;
  method: string;
  parameters: any;
}

interface ToolsResponse {
  tools: Tool[];
}

interface CustomToolsResponse {
  custom_tools: CustomTool[];
}

interface StreamToken {
  token?: string;
  done?: boolean;
  error?: string;
}

const messageInput = document.getElementById('message-input') as HTMLInputElement;
if (!messageInput) throw new Error('Message input not found');
const imageInput = document.getElementById('image-input') as HTMLInputElement;
if (!imageInput) throw new Error('Image input not found');
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
if (!sendButton) throw new Error('Send button not found');
const messagesDiv = document.getElementById('messages') as HTMLDivElement;
if (!messagesDiv) throw new Error('Messages div not found');
const spinner = document.getElementById('spinner') as HTMLDivElement;
if (!spinner) throw new Error('Spinner not found');
const toolsList = document.getElementById('tools-list') as HTMLDivElement;
if (!toolsList) throw new Error('Tools list not found');
const customToolsList = document.getElementById('custom-tools-list') as HTMLDivElement;
if (!customToolsList) throw new Error('Custom tools list not found');
const clearButton = document.getElementById('clear-button') as HTMLButtonElement;
if (!clearButton) throw new Error('Clear button not found');
const streamToggle = document.getElementById('stream-toggle') as HTMLInputElement;
if (!streamToggle) throw new Error('Stream toggle not found');
sendButton.addEventListener('click', sendMessage);
clearButton.addEventListener('click', clearChat);
messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage(): Promise<void> {
  const message = messageInput.value.trim();
  const imageFile = imageInput.files?.[0];
  const useStreaming = streamToggle.checked;

  if (!message && !imageFile) return;

  // Display user message
  displayMessage(message, 'user');

  let base64Image: string | null = null;
  if (imageFile) {
    base64Image = await uploadImage(imageFile);
    const imageDataUrl = "data:" + imageFile.type + ";base64," + base64Image;
    displayMessage(`<img src="${imageDataUrl}" alt="Uploaded image" style="max-width: 200px;">`, 'user');
  }

  // Show spinner
  spinner.style.display = 'block';
  sendButton.disabled = true;

  if (useStreaming) {
    await sendStreamingMessage(message, base64Image);
  } else {
    await sendRegularMessage(message, base64Image);
  }

  // Hide spinner
  spinner.style.display = 'none';
  sendButton.disabled = false;

  // Clear inputs
  messageInput.value = '';
  imageInput.value = '';
}

async function sendRegularMessage(message: string, base64Image: string | null): Promise<void> {
  try {
    const response = await fetch('/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, base64Image }),
    });

    if (!response.ok) throw new Error('Failed to send message');

    const data: { response: string } = await response.json();
    displayMessage(data.response, 'assistant');
  } catch (error) {
    displayMessage('Error: ' + (error as Error).message, 'assistant');
  }
}

async function sendStreamingMessage(message: string, base64Image: string | null): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      params.append('message', message);
      if (base64Image) {
        params.append('base64Image', base64Image);
      }

      const streamUrl = `/chat/stream?${params.toString()}`;
      console.log('Connecting to streaming URL:', streamUrl);

      const eventSource = new EventSource(streamUrl);

      let currentMessageDiv: HTMLDivElement | null = null;
      let messageContent = '';

      eventSource.onopen = () => {
        console.log('EventSource connection opened');
        // Hide spinner when connection is established
        spinner.style.display = 'none';
      };

      eventSource.onmessage = (event) => {
        console.log('Received streaming data:', event.data);
        try {
          const data: StreamToken = JSON.parse(event.data);

          if (data.error) {
            console.error('Streaming error:', data.error);
            displayMessage('Error: ' + data.error, 'assistant');
            eventSource.close();
            resolve();
            return;
          }

          if (data.token) {
            console.log('Received token:', data.token);
            messageContent += data.token;

            if (!currentMessageDiv) {
              currentMessageDiv = createStreamingMessageDiv();
            }

            updateStreamingMessage(currentMessageDiv, messageContent);
          }

          if (data.done) {
            console.log('Streaming done');
            eventSource.close();
            resolve();
          }
        } catch (e) {
          console.error('Error parsing stream data:', e, 'Raw data:', event.data);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        console.error('EventSource readyState:', eventSource.readyState);
        displayMessage('Error: Streaming connection failed', 'assistant');
        eventSource.close();
        resolve();
      };

      // Add timeout for connection
      setTimeout(() => {
        if (eventSource.readyState === EventSource.CONNECTING) {
          console.error('EventSource connection timeout');
          eventSource.close();
          displayMessage('Error: Streaming connection timeout', 'assistant');
          resolve();
        }
      }, 5000);

    } catch (error) {
      console.error('Error creating EventSource:', error);
      displayMessage('Error: ' + (error as Error).message, 'assistant');
      resolve();
    }
  });
}

function createStreamingMessageDiv(): HTMLDivElement {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant-message streaming';

  const timestamp = new Date().toLocaleTimeString();
  messageDiv.innerHTML = `<div class="message-content"></div><div class="timestamp">${timestamp}</div>`;

  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  return messageDiv;
}

function updateStreamingMessage(messageDiv: HTMLDivElement, content: string): void {
  const contentDiv = messageDiv.querySelector('.message-content') as HTMLDivElement;
  if (contentDiv) {
    contentDiv.textContent = content;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);

  const response = await fetch('/upload', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) throw new Error('Failed to upload image');

  const data: { base64Image: string } = await response.json();
  return data.base64Image;
}

function displayMessage(content: string, sender: 'user' | 'assistant'): void {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;

  const timestamp = new Date().toLocaleTimeString();
  messageDiv.innerHTML = `<div class="message-content">${content}</div><div class="timestamp">${timestamp}</div>`;

  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function clearChat(): void {
  messagesDiv.innerHTML = '';
}



// Load and display available tools
async function loadTools(): Promise<void> {
  try {
    const response = await fetch('/tools');
    if (!response.ok) throw new Error('Failed to load tools');

    const data: ToolsResponse = await response.json();
    displayTools(data.tools, toolsList);
  } catch (error) {
    console.error('Error loading tools:', error);
    toolsList.innerHTML = '<p>Error loading tools</p>';
  }
}

// Load and display custom tools
async function loadCustomTools(): Promise<void> {
  try {
    const response = await fetch('/custom-tools');
    if (!response.ok) throw new Error('Failed to load custom tools');

    const data: CustomToolsResponse = await response.json();
    displayCustomTools(data.custom_tools, customToolsList);
  } catch (error) {
    console.error('Error loading custom tools:', error);
    customToolsList.innerHTML = '<p>Error loading custom tools</p>';
  }
}

function displayTools(tools: Tool[], container: HTMLDivElement): void {
  container.innerHTML = '';
  if (tools.length === 0) {
    container.innerHTML = '<p>No tools available</p>';
    return;
  }

  tools.forEach(tool => {
    const toolDiv = document.createElement('div');
    toolDiv.className = 'tool-item';
    toolDiv.innerHTML = `
      <h4>${tool.name}</h4>
      <p>${tool.description}</p>
    `;
    container.appendChild(toolDiv);
  });
}

function displayCustomTools(customTools: CustomTool[], container: HTMLDivElement): void {
  container.innerHTML = '';
  if (customTools.length === 0) {
    container.innerHTML = '<p>No custom tools registered</p>';
    return;
  }

  customTools.forEach(tool => {
    const toolDiv = document.createElement('div');
    toolDiv.className = 'tool-item';
    toolDiv.innerHTML = `
      <h4>${tool.name}</h4>
      <p>${tool.method} ${tool.endpoint}</p>
    `;
    container.appendChild(toolDiv);
  });
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  loadTools();
  loadCustomTools();
});
