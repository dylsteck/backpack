/**
 * ChatPanel Component
 * Slide-up chat panel for AI conversations
 */

import { Component } from './Component';
import { createElement, clearChildren, escapeHtml } from '../utils/dom';
import { api } from '../api';

interface ChatPanelOptions {
  onClose: () => void;
  initialMessage?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

export class ChatPanel extends Component {
  private options: ChatPanelOptions;
  private messagesContainer: HTMLElement | null = null;
  private inputElement: HTMLInputElement | null = null;
  private messages: ChatMessage[] = [];
  private sessionId: string | null = null;
  private isLoading = false;
  
  constructor(container: HTMLElement, options: ChatPanelOptions) {
    super(container);
    this.options = options;
  }
  
  async init(): Promise<void> {
    this.render();
    
    // If there's an initial message, send it
    if (this.options.initialMessage) {
      // Small delay to let the panel animate in
      setTimeout(() => {
        this.sendMessage(this.options.initialMessage!);
      }, 300);
    }
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    // Backdrop
    const backdrop = createElement('div', {
      className: 'absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200',
    });
    this.addListener(backdrop, 'click', (e) => {
      if (e.target === backdrop) {
        this.options.onClose();
      }
    });
    this.container.appendChild(backdrop);
    
    // Panel
    const panel = createElement('div', {
      className: 'absolute inset-0 bg-background flex flex-col animate-in slide-in-from-bottom duration-300',
    });
    
    // Header
    const header = createElement('div', {
      className: 'flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0',
    });
    
    const title = createElement('div', {
      className: 'flex items-center gap-2',
    });
    title.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-primary">
        <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
      </svg>
      <span class="font-mono uppercase tracking-wider text-sm">Ask Cortex</span>
    `;
    header.appendChild(title);
    
    const closeButton = createElement('button', {
      className: 'p-2 hover:bg-accent rounded-lg transition-colors',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6 6 18"/>
          <path d="m6 6 12 12"/>
        </svg>
      `,
    });
    this.addListener(closeButton, 'click', () => this.options.onClose());
    header.appendChild(closeButton);
    
    panel.appendChild(header);
    
    // Messages container
    this.messagesContainer = createElement('div', {
      className: 'flex-1 overflow-y-auto p-4 space-y-4',
    });
    
    // Welcome message
    if (this.messages.length === 0) {
      this.renderWelcomeState();
    }
    
    panel.appendChild(this.messagesContainer);
    
    // Input area
    const inputArea = createElement('div', {
      className: 'p-4 border-t border-border flex-shrink-0',
    });
    
    const inputWrapper = createElement('div', {
      className: 'flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3',
    });
    
    this.inputElement = createElement('input', {
      className: 'flex-1 bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground font-mono text-sm',
      attributes: {
        type: 'text',
        placeholder: 'Ask a question about your data...',
        autofocus: 'true',
      },
    }) as HTMLInputElement;
    
    this.addListener(this.inputElement, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !this.isLoading) {
        e.preventDefault();
        const value = this.inputElement!.value.trim();
        if (value) {
          this.sendMessage(value);
          this.inputElement!.value = '';
        }
      }
    });
    
    inputWrapper.appendChild(this.inputElement);
    
    const sendButton = createElement('button', {
      className: 'p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m22 2-7 20-4-9-9-4Z"/>
          <path d="M22 2 11 13"/>
        </svg>
      `,
    });
    this.addListener(sendButton, 'click', () => {
      if (!this.isLoading) {
        const value = this.inputElement!.value.trim();
        if (value) {
          this.sendMessage(value);
          this.inputElement!.value = '';
        }
      }
    });
    inputWrapper.appendChild(sendButton);
    
    inputArea.appendChild(inputWrapper);
    panel.appendChild(inputArea);
    
    this.container.appendChild(panel);
    
    // Focus input
    setTimeout(() => this.inputElement?.focus(), 100);
  }
  
  private renderWelcomeState(): void {
    if (!this.messagesContainer) return;
    
    this.messagesContainer.innerHTML = `
      <div class="flex flex-col items-center justify-center h-full text-center">
        <div class="w-16 h-16 flex items-center justify-center bg-primary/10 rounded-2xl mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-primary">
            <path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z"/>
          </svg>
        </div>
        <h3 class="text-lg font-mono uppercase tracking-wider mb-2">Ask anything</h3>
        <p class="text-muted-foreground text-sm max-w-md">
          Ask questions about your timeline, get summaries, or explore your data.
        </p>
      </div>
    `;
  }
  
  private async sendMessage(content: string): Promise<void> {
    if (this.isLoading) return;
    
    this.isLoading = true;
    
    // Create session if needed
    if (!this.sessionId) {
      try {
        const result = await api.chat.createSession.mutate({});
        if (result.success) {
          this.sessionId = result.session.id;
        }
      } catch (error) {
        console.error('Failed to create chat session:', error);
        this.isLoading = false;
        return;
      }
    }
    
    // Add user message to UI
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      createdAt: new Date(),
    };
    this.messages.push(userMessage);
    this.renderMessages();
    
    // Save user message to database
    try {
      await api.chat.addMessage.mutate({
        sessionId: this.sessionId!,
        role: 'user',
        content,
      });
    } catch (error) {
      console.error('Failed to save user message:', error);
    }
    
    // Show loading state
    this.renderLoadingMessage();
    
    // Get AI response
    try {
      const response = await this.getAIResponse(content);
      
      // Add assistant message
      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: response,
        createdAt: new Date(),
      };
      this.messages.push(assistantMessage);
      
      // Save assistant message to database
      await api.chat.addMessage.mutate({
        sessionId: this.sessionId!,
        role: 'assistant',
        content: response,
      });
      
      this.renderMessages();
    } catch (error) {
      console.error('Failed to get AI response:', error);
      // Show error message
      const errorMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        createdAt: new Date(),
      };
      this.messages.push(errorMessage);
      this.renderMessages();
    }
    
    this.isLoading = false;
  }
  
  private async getAIResponse(userMessage: string): Promise<string> {
    // For now, use a simple fetch to the chat endpoint
    // This can be expanded to use streaming later
    try {
      const response = await fetch(`http://localhost:${await this.getServerPort()}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: userMessage },
          ],
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      let fullResponse = '';
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        // Parse SSE format
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('0:')) {
            // Text chunk
            const text = line.slice(2).trim();
            if (text.startsWith('"') && text.endsWith('"')) {
              fullResponse += JSON.parse(text);
            }
          }
        }
      }
      
      return fullResponse || 'I received your message but couldn\'t generate a response.';
    } catch (error) {
      console.error('Chat API error:', error);
      throw error;
    }
  }
  
  private async getServerPort(): Promise<number> {
    if (typeof window !== 'undefined' && (window as any).serverApi?.getPort) {
      const port = await (window as any).serverApi.getPort();
      if (port) return port;
    }
    return 3000;
  }
  
  private renderMessages(): void {
    if (!this.messagesContainer) return;
    
    clearChildren(this.messagesContainer);
    
    for (const message of this.messages) {
      const messageEl = this.createMessageElement(message);
      this.messagesContainer.appendChild(messageEl);
    }
    
    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
  
  private createMessageElement(message: ChatMessage): HTMLElement {
    const isUser = message.role === 'user';
    
    const wrapper = createElement('div', {
      className: `flex ${isUser ? 'justify-end' : 'justify-start'}`,
    });
    
    const bubble = createElement('div', {
      className: `max-w-[80%] p-3 rounded-lg ${
        isUser
          ? 'bg-primary text-primary-foreground'
          : 'bg-card border border-border'
      }`,
    });
    
    const content = createElement('p', {
      className: 'text-sm whitespace-pre-wrap',
      textContent: message.content,
    });
    bubble.appendChild(content);
    
    wrapper.appendChild(bubble);
    return wrapper;
  }
  
  private renderLoadingMessage(): void {
    if (!this.messagesContainer) return;
    
    const wrapper = createElement('div', {
      className: 'flex justify-start loading-message',
    });
    
    const bubble = createElement('div', {
      className: 'max-w-[80%] p-3 rounded-lg bg-card border border-border',
    });
    
    bubble.innerHTML = `
      <div class="flex items-center gap-2">
        <div class="flex gap-1">
          <div class="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
          <div class="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
          <div class="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
        </div>
        <span class="text-sm text-muted-foreground">Thinking...</span>
      </div>
    `;
    
    wrapper.appendChild(bubble);
    this.messagesContainer.appendChild(wrapper);
    
    // Scroll to bottom
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }
}

export default ChatPanel;

