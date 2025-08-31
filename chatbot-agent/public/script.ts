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
const chatWindow = document.getElementById('chat-window') as HTMLDivElement;
if (!chatWindow) throw new Error('Chat window not found');
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

function isAtBottom(): boolean {
  return messagesDiv.scrollTop + messagesDiv.clientHeight >= messagesDiv.scrollHeight - 10;
}

async function sendMessage(): Promise<void> {
  const message = messageInput.value.trim();
  const imageFile = imageInput.files?.[0] || null;
  const useStreaming = streamToggle.checked;

  if (!message && !imageFile) return;

  // Scroll to bottom when sending message
  setTimeout(() => {
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
  }, 10);

  // Display user message
  displayMessage(message, 'user');

  if (imageFile) {
    const imageDataUrl = URL.createObjectURL(imageFile);
    displayMessage(`<img src="${imageDataUrl}" alt="Uploaded image" style="max-width: 200px;">`, 'user');
  }

  // Show spinner
  spinner.style.display = 'block';
  sendButton.disabled = true;

  if (useStreaming) {
    await sendStreamingMessage(message, imageFile);
  } else {
    await sendRegularMessage(message, imageFile);
  }

  // Hide spinner
  spinner.style.display = 'none';
  sendButton.disabled = false;

  // Clear inputs
  messageInput.value = '';
  imageInput.value = '';
}

async function sendRegularMessage(message: string, imageFile: File | null): Promise<void> {
  try {
    let response: Response;
    if (imageFile) {
      const formData = new FormData();
      formData.append('message', message);
      formData.append('image', imageFile);
      response = await fetch('/chat', {
        method: 'POST',
        body: formData,
      });
    } else {
      response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
    }

    if (!response.ok) throw new Error('Failed to send message');

    const data: { response: string } = await response.json();
    displayMessage(data.response, 'assistant');
  } catch (error) {
    displayMessage('Error: ' + (error as Error).message, 'assistant');
  }
}

async function sendStreamingMessage(message: string, imageFile: File | null): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      console.log('Sending streaming request with POST');

      let fetchPromise: Promise<Response>;
      if (imageFile) {
        const formData = new FormData();
        formData.append('message', message);
        formData.append('image', imageFile);
        fetchPromise = fetch('/chat/stream', {
          method: 'POST',
          body: formData,
        });
      } else {
        fetchPromise = fetch('/chat/stream', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message }),
        });
      }

      fetchPromise
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Hide spinner when connection is established
        spinner.style.display = 'none';

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let currentMessageDiv: HTMLDivElement | null = null;
        let messageContent = '';
        let buffer = '';

        const readStream = () => {
          reader?.read().then(({ done, value }) => {
            if (done) {
              console.log('Stream finished');
              resolve();
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');

            // Keep the last incomplete line in buffer
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('data: ')) {
                const data = trimmedLine.slice(6);
                console.log('Received streaming data:', data);

                try {
                  const parsed: StreamToken = JSON.parse(data);

                  if (parsed.error) {
                    console.error('Streaming error:', parsed.error);
                    displayMessage('Error: ' + parsed.error, 'assistant');
                    resolve();
                    return;
                  }

                  if (parsed.token) {
                    console.log('Received token:', parsed.token);
                    messageContent += parsed.token;

                    if (!currentMessageDiv) {
                      currentMessageDiv = createStreamingMessageDiv();
                    }

                    updateStreamingMessage(currentMessageDiv, messageContent);
                  }

                  if (parsed.done) {
                    console.log('Streaming done');
                    resolve();
                    return;
                  }
                } catch (e) {
                  console.error('Error parsing stream data:', e, 'Raw data:', data);
                }
              }
            }

            readStream();
          }).catch(error => {
            console.error('Stream reading error:', error);
            displayMessage('Error: Streaming connection failed', 'assistant');
            resolve();
          });
        };

        readStream();
      })
      .catch(error => {
        console.error('Fetch error:', error);
        displayMessage('Error: ' + error.message, 'assistant');
        resolve();
      });

    } catch (error) {
      console.error('Error creating streaming request:', error);
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

  // Ensure scroll happens after DOM update
  setTimeout(() => {
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
  }, 10);

  return messageDiv;
}

function updateStreamingMessage(messageDiv: HTMLDivElement, content: string): void {
  const contentDiv = messageDiv.querySelector('.message-content') as HTMLDivElement;
  if (contentDiv) {
    contentDiv.textContent = content;

    // Ensure scroll happens after DOM update
    setTimeout(() => {
      chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
    }, 10);
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

  // Ensure scroll happens after DOM update
  setTimeout(() => {
    chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
  }, 10);
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
