const messageInput = document.getElementById('message-input')! as HTMLInputElement;
const imageInput = document.getElementById('image-input')! as HTMLInputElement;
const sendButton = document.getElementById('send-button')! as HTMLButtonElement;
const messagesDiv = document.getElementById('messages')! as HTMLDivElement;
const spinner = document.getElementById('spinner')! as HTMLDivElement;

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
    displayMessage(`<img src="${base64Image}" alt="Uploaded image" style="max-width: 200px;">`, 'user');
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
