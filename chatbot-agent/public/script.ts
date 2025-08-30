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

sendButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e: KeyboardEvent) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage(): Promise<void> {
  const message = messageInput.value.trim();
  const imageFile = imageInput.files?.[0];

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

  // Send to server
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

  // Hide spinner
  spinner.style.display = 'none';
  sendButton.disabled = false;

  // Clear inputs
  messageInput.value = '';
  imageInput.value = '';
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
  messageDiv.innerHTML = content;
  messagesDiv.appendChild(messageDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Load and display available tools
async function loadTools(): Promise<void> {
  try {
    const response = await fetch('/tools');
    if (!response.ok) throw new Error('Failed to load tools');

    const data: { tools: any[] } = await response.json();
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

    const data: { custom_tools: any[] } = await response.json();
    displayCustomTools(data.custom_tools, customToolsList);
  } catch (error) {
    console.error('Error loading custom tools:', error);
    customToolsList.innerHTML = '<p>Error loading custom tools</p>';
  }
}

function displayTools(tools: any[], container: HTMLDivElement): void {
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

function displayCustomTools(customTools: any[], container: HTMLDivElement): void {
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
