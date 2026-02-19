/**
 * Onboarding Component
 * Welcome flow for new users
 */

import { Component } from './Component';
import { store, actions } from '../store';
import { router } from '../router';
import { fetchAppsWithCache, api, appsCache, fetchApps } from '../api';
import { createElement, clearChildren } from '../utils/dom';
import type { AppServer } from '../types';

// Import icon
import iconImage from '@/assets/images/icon.png';

// Declare the window interfaces
declare global {
  interface Window {
    databaseApi: {
      selectFolder: () => Promise<string | null>;
      getPath: () => Promise<string | null>;
      setPath: (path: string) => Promise<{ success: boolean }>;
      getDefaultPath: () => Promise<string>;
      initDatabase: (path: string) => Promise<{ success: boolean; path?: string; error?: string }>;
    };
    electronDeepLink: {
      onCallback: (callback: (data: DeepLinkCallbackData) => void) => void;
      removeCallback: () => void;
    };
    serverApi: {
      getPort: () => Promise<number | null>;
    };
    shellApi: {
      openExternal: (url: string) => Promise<void>;
      checkCliInstalled: () => Promise<{ installed: boolean; version?: string }>;
      installCli: () => Promise<{ success: boolean; error?: string }>;
      checkQmdInstalled: () => Promise<{ installed: boolean; version?: string }>;
      installQmd: () => Promise<{ success: boolean; error?: string }>;
    };
  }
}

// Deep link callback data interface
interface DeepLinkCallbackData {
  success: boolean;
  sessionToken: string | null;
  accessToken?: string | null;
  enrollmentId?: string | null;
  institutionName?: string | null;
  error?: string | null;
}

// Apps that have working OAuth callbacks
const OAUTH_SUPPORTED_APPS = ['teller'];

type OnboardingStep = 1 | 2 | 3;

export class Onboarding extends Component {
  private currentStep: OnboardingStep = 1;
  private connectedApps = new Set<string>();
  private connectingApps = new Set<string>();
  private contentContainer: HTMLElement | null = null;
  private isInitializing: boolean = false;
  // Track pending OAuth sessions: sessionToken -> appId
  private pendingOAuthSessions = new Map<string, string>();
  
  async init(): Promise<void> {
    // Subscribe to apps store to trigger re-renders when data arrives
    this.subscribe(store.apps, () => {
      if (this.currentStep === 3) {
        this.render();
      }
    });
    
    // Set up deep link callback listener for OAuth
    this.setupDeepLinkListener();
    
    this.render();
  }
  
  private setupDeepLinkListener(): void {
    if (typeof window !== 'undefined' && window.electronDeepLink) {
      window.electronDeepLink.onCallback(async (data: DeepLinkCallbackData) => {
        console.log('[Onboarding] Deep link callback received:', data);
        
        if (data.sessionToken && this.pendingOAuthSessions.has(data.sessionToken)) {
          const appId = this.pendingOAuthSessions.get(data.sessionToken)!;
          this.pendingOAuthSessions.delete(data.sessionToken);
          
          if (data.success && data.accessToken) {
            try {
              // Save Teller token to database
              console.log(`[Onboarding] Saving Teller token for ${appId}...`);
              await api.apps.saveTellerToken.mutate({
                appId: appId,
                accessToken: data.accessToken,
                enrollmentId: data.enrollmentId || undefined,
                institutionName: data.institutionName || undefined,
              });
              
              // Refresh apps to get updated connection status
              appsCache.clear();
              await fetchApps();
              
              // OAuth succeeded - mark as connected
              this.connectedApps.add(appId);
              this.connectingApps.delete(appId);
              console.log(`[Onboarding] OAuth success for ${appId}`);
            } catch (error) {
              console.error(`[Onboarding] Failed to save token for ${appId}:`, error);
              this.connectingApps.delete(appId);
              alert(`Failed to save connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
          } else if (!data.success) {
            // OAuth failed
            this.connectingApps.delete(appId);
            console.error(`[Onboarding] OAuth failed for ${appId}:`, data.error);
            alert(`Failed to connect: ${data.error || 'Unknown error'}`);
          }
          
          this.render();
        }
      });
      
      // Clean up listener when component is destroyed
      this.registerCleanup(() => {
        window.electronDeepLink?.removeCallback();
      });
    }
  }
  
  render(): void {
    this.container.innerHTML = '';
    
    // Create inner wrapper for onboarding content
    const wrapper = createElement('div', {
      className: 'flex flex-col h-full w-full max-w-xl mx-auto px-6 relative pt-24 pb-20',
    });
    
    // Skip button (visible on step 3 - apps selection)
    if (this.currentStep === 3) {
      const skipButton = createElement('button', {
        className: 'absolute top-6 right-6 px-4 py-1.5 hover:text-black transition-colors font-sans text-sm text-muted-foreground',
        textContent: 'Skip',
      });
      this.addListener(skipButton, 'click', () => this.completeOnboarding());
      wrapper.appendChild(skipButton);
    }
    
    // Main content area
    this.contentContainer = createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-between min-h-0 pt-12',
    });
    this.renderStep();
    wrapper.appendChild(this.contentContainer);
    
    // Step indicators (hidden on welcome step)
    if (this.currentStep !== 1) {
      const indicators = this.createStepIndicators();
      wrapper.appendChild(indicators);
    }
    
    this.container.appendChild(wrapper);
  }
  
  private renderStep(): void {
    if (!this.contentContainer) return;
    clearChildren(this.contentContainer);
    
    switch (this.currentStep) {
      case 1:
        this.renderWelcomeStep();
        break;
      case 2:
        this.renderCreateVaultStep();
        break;
      case 3:
        this.renderConnectAppsStep();
        break;
    }
  }
  
  private renderWelcomeStep(): void {
    if (!this.contentContainer) return;
    
    const stack = createElement('div', {
      className: 'flex flex-col items-center w-full h-full animate-in fade-in zoom-in-95 duration-500',
    });

    // Top section: icon + name centered in available space
    const topSection = createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-center space-y-6',
    });

    // Icon
    const logo = createElement('img', {
      className: 'h-32 w-32 object-contain',
      attributes: {
        src: iconImage,
        alt: 'Cortex',
      },
    });
    topSection.appendChild(logo);

    stack.appendChild(topSection);
    this.contentContainer.appendChild(stack);

    // Button fixed near bottom — outside animated stack to prevent layout shift
    const continueButton = createElement('button', {
      className: 'px-10 py-2.5 bg-black text-white font-sans font-medium text-sm rounded-full shadow-lg hover:shadow-xl hover:bg-black/90 transition-all active:scale-95 fixed bottom-10 left-1/2 -translate-x-1/2',
      textContent: 'Get Started',
    });
    this.addListener(continueButton, 'click', () => this.nextStep());
    this.contentContainer.appendChild(continueButton);
  }

  private renderCreateVaultStep(): void {
    if (!this.contentContainer) return;
    
    const stack = createElement('div', {
      className: 'flex flex-col items-center space-y-10 w-full animate-in fade-in slide-in-from-right-4 duration-500',
    });
    
    // Icon - Vault icon for Step 2
    const iconWrapper = createElement('div', {
      className: 'h-24 w-24 flex items-center justify-center bg-card border-2 border-primary/20 rounded-2xl text-primary shadow-xl',
      innerHTML: `
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      `,
    });
    stack.appendChild(iconWrapper);
    
    // Text
    const textWrapper = createElement('div', {
      className: 'text-center space-y-3',
    });
    textWrapper.innerHTML = `
      <h1 class="text-4xl font-sans font-semibold text-primary">
        Create Vault
      </h1>
      <p class="text-lg text-muted-foreground font-sans leading-relaxed">
        Choose where to store your data
      </p>
    `;
    stack.appendChild(textWrapper);

    // Button
    const createButton = createElement('button', {
      className: `px-10 py-2.5 bg-black text-white font-sans font-medium text-sm rounded-lg hover:opacity-90 transition-all hover:scale-105 active:scale-95 flex items-center gap-3 ${this.isInitializing ? 'opacity-50 cursor-not-allowed' : ''}`,
      innerHTML: this.isInitializing ? `
        <svg class="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Creating vault...
      ` : `
        Create Vault
      `,
    });
    if (!this.isInitializing) {
      this.addListener(createButton, 'click', () => this.handleCreateVault());
    }
    stack.appendChild(createButton);
    
    this.contentContainer.appendChild(stack);
  }
  
  private async handleCreateVault(): Promise<void> {
    if (this.isInitializing) return;
    
    try {
      // Open file picker
      const selectedFolder = await window.databaseApi.selectFolder();
      if (!selectedFolder) {
        // User cancelled
        return;
      }
      
      // Append cortex.db to the selected folder
      const databasePath = `${selectedFolder}/cortex.db`;
      
      this.isInitializing = true;
      this.render();
      
      // Initialize database
      const result = await window.databaseApi.initDatabase(databasePath);
      if (result.success) {
        // Store the path in the app's store
        actions.setDatabasePath(databasePath);
        
        // Now that database is ready, fetch apps for the next step
        fetchAppsWithCache();
        
        // Setup CLI automatically (non-blocking)
        this.setupCLI().catch((error) => {
          console.error('[Onboarding] CLI setup failed (non-critical):', error);
          // Don't block onboarding if CLI setup fails
        });
        
        this.nextStep();
      } else {
        console.error('Failed to initialize database:', result.error);
        alert(`Failed to create vault: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create vault:', error);
      alert(`Failed to create vault: ${error}`);
    } finally {
      this.isInitializing = false;
      this.render();
    }
  }
  
  private async renderConnectAppsStep(): Promise<void> {
    if (!this.contentContainer) return;
    
    // Use flex layout to ensure buttons stay visible
    const wrapper = createElement('div', {
      className: 'flex flex-col items-center w-full h-full min-h-0 animate-in fade-in slide-in-from-right-4 duration-500',
    });
    
    // Title
    const titleWrapper = createElement('div', {
      className: 'text-center space-y-1 flex-shrink-0 pt-2',
    });
    titleWrapper.innerHTML = `
      <h2 class="text-2xl font-sans font-semibold text-black">Connect your apps</h2>
      <p class="text-sm text-muted-foreground font-sans">
        Choose the services you'd like to link
      </p>
    `;
    wrapper.appendChild(titleWrapper);

    // Apps grid — scrollable
    const appsContainer = createElement('div', {
      className: 'w-full flex-1 min-h-0 overflow-y-auto px-1 py-4',
    });

    const apps = store.apps.get();

    if (apps.length === 0) {
      appsContainer.innerHTML = `
        <div class="grid grid-cols-3 gap-2.5">
          ${[1, 2, 3, 4, 5, 6].map(() => '<div class="h-20 bg-muted/30 animate-pulse rounded-xl"></div>').join('')}
        </div>
      `;
    } else {
      const grid = createElement('div', {
        className: 'grid grid-cols-3 gap-2.5',
      });

      for (const app of apps) {
        const card = this.createAppCard(app);
        grid.appendChild(card);
      }

      appsContainer.appendChild(grid);
    }
    wrapper.appendChild(appsContainer);

    // Finish button fixed near stepper
    const finishButton = createElement('button', {
      className: 'px-10 py-2.5 bg-black text-white rounded-full shadow-lg hover:shadow-xl hover:bg-black/90 font-sans font-medium text-sm transition-all active:scale-95 fixed bottom-12 left-1/2 -translate-x-1/2',
      textContent: 'Finish',
    });
    this.addListener(finishButton, 'click', () => this.completeOnboarding());

    this.contentContainer.appendChild(wrapper);
    this.contentContainer.appendChild(finishButton);
  }
  
  private createAppCard(app: AppServer): HTMLElement {
    const isConnected = app.connection?.status === 'connected' || this.connectedApps.has(app.id);
    const isConnecting = this.connectingApps.has(app.id);
    
    const card = createElement('button', {
      className: `group relative flex flex-col items-center justify-center p-3 border transition-all duration-200 cursor-pointer rounded-xl ${
        isConnected
          ? 'border-green-500/40 bg-green-50'
          : isConnecting
            ? 'border-black/10 bg-muted/30 opacity-70'
            : 'border-black/[0.06] bg-white hover:border-black/15 hover:shadow-sm'
      }`,
    });
    
    // Icon or spinner
    if (isConnecting) {
      const spinner = createElement('div', {
        className: 'h-8 w-8 mb-2 flex items-center justify-center',
        innerHTML: `<svg class="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>`,
      });
      card.appendChild(spinner);
    } else if (app.iconUrl) {
      const icon = createElement('img', {
        className: 'h-8 w-8 object-contain mb-2',
        attributes: {
          src: app.iconUrl,
          alt: app.name,
        },
      });
      card.appendChild(icon);
    }
    
    // Name
    const name = createElement('p', {
      className: 'text-[11px] font-sans text-center text-muted-foreground',
      textContent: app.name,
    });
    card.appendChild(name);
    
    // Status indicator
    if (isConnected) {
      // Checkmark for connected apps
      const checkmark = createElement('div', {
        className: 'absolute top-1.5 right-1.5 w-4 h-4 bg-status-connected rounded-full flex items-center justify-center',
        innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
      });
      card.appendChild(checkmark);
    }
    
    // Click handler - trigger connection
    if (!isConnected && !isConnecting) {
      this.addListener(card, 'click', () => this.handleAppConnect(app));
    }
    
    return card;
  }
  
  private async handleAppConnect(app: AppServer): Promise<void> {
    // Mark as connecting
    this.connectingApps.add(app.id);
    this.render();
    
    try {
      if (app.oauth) {
        // OAuth apps - open in browser for authentication
        // Note: handleOAuthConnect manages its own connecting state for OAuth flow
        await this.handleOAuthConnect(app);
        // Don't clear connecting state here - wait for callback (for supported OAuth)
        // If not supported, handleOAuthConnect already cleared it
        return;
      } else if (app.connectionType === 'file') {
        // File-based apps (Chrome, Brave)
        await this.handleFileConnect(app);
      } else if (app.connectionType === 'api' && app.id === 'farcaster') {
        // Farcaster needs API key - redirect to app detail page
        this.connectingApps.delete(app.id);
        this.completeOnboarding();
        router.navigate(`/apps/${app.id}`);
        return;
      } else if (app.connectionType === 'mcp') {
        // MCP apps - create connection directly
        await this.handleMcpConnect(app);
      } else {
        // Default - just mark as connected (placeholder)
        console.log(`[Onboarding] App ${app.name} connection type not yet supported`);
        this.connectedApps.add(app.id);
      }
    } catch (error) {
      console.error(`[Onboarding] Failed to connect ${app.name}:`, error);
      alert(`Failed to connect ${app.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    // Clear connecting state for non-OAuth apps
    this.connectingApps.delete(app.id);
    this.render();
  }
  
  private async handleOAuthConnect(app: AppServer): Promise<void> {
    // Check if this OAuth app has a working callback handler
    if (!OAUTH_SUPPORTED_APPS.includes(app.id)) {
      // OAuth not yet supported for this app - show message and redirect to apps page
      this.connectingApps.delete(app.id);
      this.render();
      
      const goToApps = confirm(
        `${app.name} requires OAuth setup which is best done from the Apps page. Would you like to go there now?`
      );
      
      if (goToApps) {
        this.completeOnboarding();
        router.navigate(`/apps/${app.id}`);
      }
      return;
    }
    
    // Handle Teller OAuth specifically
    if (app.id === 'teller') {
      await this.handleTellerOAuth(app);
      return;
    }
    
    // For other supported OAuth apps, use standard flow
    const config = app.config as { url?: string } | undefined;
    const oauthUrl = config?.url;
    
    if (oauthUrl) {
      // Generate a session token
      const sessionToken = crypto.randomUUID();
      this.pendingOAuthSessions.set(sessionToken, app.id);
      
      // Open in system browser
      const urlWithSession = `${oauthUrl}?sessionToken=${sessionToken}`;
      if (window.shellApi) {
        await window.shellApi.openExternal(urlWithSession);
      } else {
        window.open(urlWithSession, '_blank');
      }
      
      // Keep showing spinner - wait for callback
      // Don't mark as connected until callback received
    } else {
      throw new Error('OAuth URL not configured');
    }
  }
  
  private async handleTellerOAuth(app: AppServer): Promise<void> {
    // For Teller, we need to:
    // 1. Generate a session token
    // 2. Open the /teller/connect URL with the token
    // 3. Wait for the deep link callback
    
    const sessionToken = crypto.randomUUID();
    this.pendingOAuthSessions.set(sessionToken, app.id);
    
    // Get the server port to construct the URL
    let serverPort = 3000; // Default
    if (window.serverApi) {
      const port = await window.serverApi.getPort();
      if (port) serverPort = port;
    }
    
    const tellerConnectUrl = `http://localhost:${serverPort}/teller/connect?token=${sessionToken}`;
    
    // Open in system browser
    if (window.shellApi) {
      await window.shellApi.openExternal(tellerConnectUrl);
    } else {
      window.open(tellerConnectUrl, '_blank');
    }
    
    // Keep showing spinner - the deep link callback will handle the rest
    console.log(`[Onboarding] Opened Teller connect with session: ${sessionToken}`);
    
    // Set a timeout to cancel the pending session if no callback received
    this.registerTimeout(() => {
      if (this.pendingOAuthSessions.has(sessionToken)) {
        console.log(`[Onboarding] OAuth session timed out for ${app.id}`);
        this.pendingOAuthSessions.delete(sessionToken);
        this.connectingApps.delete(app.id);
        this.render();
      }
    }, 5 * 60 * 1000); // 5 minute timeout
  }
  
  private async handleFileConnect(app: AppServer): Promise<void> {
    // For file-based apps like Chrome/Brave, we need to locate the history file
    // This is handled by the browser history IPC
    
    if (app.id === 'chrome' || app.id === 'brave') {
      // Create connection - the browser history will be loaded automatically
      await api.apps.addConnection.mutate({
        serverId: app.id,
        serverName: app.name,
        transportType: 'file',
        transportConfig: {},
      });
      
      // Refresh apps to get updated connection status
      appsCache.clear();
      await fetchApps();
      
      this.connectedApps.add(app.id);
    }
  }
  
  private async handleMcpConnect(app: AppServer): Promise<void> {
    // For MCP apps, we create a connection directly
    const config = app.config as { url?: string; command?: string; args?: string[] } | undefined;
    
    if (config?.url) {
      // SSE-based MCP (like Figma, InstantDB)
      await api.apps.addConnection.mutate({
        serverId: app.id,
        serverName: app.name,
        transportType: 'sse',
        transportConfig: { url: config.url },
      });
    } else if (config?.command) {
      // stdio-based MCP (like Convex, Railway)
      await api.apps.addConnection.mutate({
        serverId: app.id,
        serverName: app.name,
        transportType: 'stdio',
        transportConfig: { command: config.command, args: config.args || [] },
      });
    }
    
    // Refresh apps to get updated connection status
    appsCache.clear();
    await fetchApps();
    
    this.connectedApps.add(app.id);
  }
  
  private createStepIndicators(): HTMLElement {
    const wrapper = createElement('div', {
      className: 'flex justify-center gap-2 fixed bottom-6 left-0 right-0 w-full',
    });
    
    for (let i = 1; i <= 3; i++) {
      const dot = createElement('div', {
        className: `h-2 rounded-full transition-all duration-300 cursor-pointer ${
          this.currentStep === i
            ? 'bg-primary w-8'
            : 'bg-muted-foreground/30 w-2 hover:bg-muted-foreground/50'
        }`,
      });
      const step = i as OnboardingStep;
      this.addListener(dot, 'click', () => {
        this.currentStep = step;
        this.render();
      });
      wrapper.appendChild(dot);
    }
    
    return wrapper;
  }
  
  private nextStep(): void {
    if (this.currentStep < 3) {
      this.currentStep = (this.currentStep + 1) as OnboardingStep;
      this.render();
    }
  }
  
  private prevStep(): void {
    if (this.currentStep > 1) {
      this.currentStep = (this.currentStep - 1) as OnboardingStep;
      this.render();
    }
  }
  
  private async setupCLI(): Promise<void> {
    try {
      // Check if CLI is already installed
      const cliCheck = await window.shellApi?.checkCliInstalled();
      if (cliCheck?.installed) {
        console.log('[Onboarding] CLI already installed:', cliCheck.version);
        return;
      }

      // Install CLI
      console.log('[Onboarding] Installing Cortex CLI...');
      const installResult = await window.shellApi?.installCli();
      if (installResult?.success) {
        console.log('[Onboarding] CLI installed successfully');
      } else {
        console.warn('[Onboarding] CLI installation failed:', installResult?.error);
        // Non-critical, continue onboarding
      }

      // Check if QMD is installed (optional, for search)
      const qmdCheck = await window.shellApi?.checkQmdInstalled();
      if (!qmdCheck?.installed) {
        console.log('[Onboarding] QMD not installed (optional for search)');
        // Don't auto-install QMD - user can install it later if they want search
      }
    } catch (error) {
      console.error('[Onboarding] Error during CLI setup:', error);
      // Non-critical, don't block onboarding
    }
  }

  private completeOnboarding(): void {
    actions.completeOnboarding();
    router.navigate('/');
  }
}

export default Onboarding;

