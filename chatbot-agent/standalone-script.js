// Standalone Chatbot Script using Transformers.js with llama2.c-stories15M
import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/dist/transformers.min.js';

const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesDiv = document.getElementById('messages');
const chatWindow = document.getElementById('chat-window');
const spinner = document.getElementById('spinner');
const clearButton = document.getElementById('clear-button');

let generator;
let conversationHistory = '';

async function initModel() {
  console.log('Loading llama2.c-stories15M model...');
  spinner.style.display = 'block';
  try {
    generator = await pipeline('text-generation', 'Xenova/llama2.c-stories15M');
    console.log('Model loaded.');
  } catch (error) {
    console.error('Error loading model:', error);
    displayMessage('Error loading model: ' + error.message, 'assistant');
  }
  spinner.style.display = 'none';
}

sendButton.addEventListener('click', sendMessage);
clearButton.addEventListener('click', clearChat);
messageInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
  const message = messageInput.value.trim();
  if (!message) return;

  displayMessage(message, 'user');
  conversationHistory += 'User: ' + message + '\n';

  spinner.style.display = 'block';
  sendButton.disabled = true;

  try {
    const prompt = conversationHistory + 'Assistant: ';
    const output = await generator(prompt, { max_length: 200, num_return_sequences: 1 });
    const response = output[0].generated_text.split('Assistant: ')[1] || 'I\'m not sure how to respond.';
    displayMessage(response, 'assistant');
    conversationHistory += 'Assistant: ' + response + '\n';
  } catch (error) {
    displayMessage('Error generating response: ' + error.message, 'assistant');
  }

  spinner.style.display = 'none';
  sendButton.disabled = false;
  messageInput.value = '';
}

function displayMessage(content, sender) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${sender}-message`;

  const timestamp = new Date().toLocaleTimeString();
  messageDiv.innerHTML = `<div class="message-content">${content}</div><div class="timestamp">${timestamp}</div>`;

  messagesDiv.appendChild(messageDiv);
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

function clearChat() {
  messagesDiv.innerHTML = '';
  conversationHistory = '';
}

// Initialize
document.addEventListener('DOMContentLoaded', initModel);
