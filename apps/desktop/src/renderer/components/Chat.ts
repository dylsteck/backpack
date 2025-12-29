/**
 * Chat Component
 * Blank page for chat functionality
 */

import { Component } from './Component';
import { createElement } from '../utils/dom';

export class Chat extends Component {
  async init(): Promise<void> {
    this.render();
  }
  
  render(): void {
    this.container.innerHTML = '';
    this.container.className = 'flex flex-col w-full h-full p-6';
    
    // Simple blank page with same layout structure
    const wrapper = createElement('div', {
      className: 'flex flex-col w-full h-full',
    });
    
    this.container.appendChild(wrapper);
  }
}

export default Chat;

