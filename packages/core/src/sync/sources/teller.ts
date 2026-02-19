/**
 * Teller banking syncer - syncs bank accounts and transactions via Teller API
 */

import crypto from "crypto";
import type { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type { TellerConfig, SourceType } from "../../config/schema.js";
import { BaseSyncer } from "../base.js";
import type { SyncProgress } from "../types.js";
import type { TimelineItem } from "../../types/index.js";
import type { TellerAccount, TellerTransaction } from "../../types/teller.js";
import * as schema from "../../db/schema.js";
import { getTellerToken } from "../../auth/keychain.js";

/**
 * Teller API client
 */
export class TellerSyncer extends BaseSyncer {
  readonly name: SourceType = "teller";
  protected declare config?: TellerConfig;
  private baseUrl: string;

  constructor(
    db: BunSQLiteDatabase<typeof schema>,
    config?: TellerConfig
  ) {
    super(db, config);
    this.config = config;
    this.baseUrl = this.getBaseUrl();
  }

  /**
   * Get the base URL based on environment
   */
  private getBaseUrl(): string {
    return this.config?.environment === "sandbox"
      ? "https://api.sandbox.teller.io"
      : "https://api.teller.io";
  }

  /**
   * Check if access token is configured in keychain
   */
  async isConfigured(): Promise<boolean> {
    try {
      const token = await getTellerToken();
      return token !== null && token.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Validate configuration by testing API call
   */
  async validateConfig(): Promise<boolean> {
    if (!this.config) {
      return false;
    }

    const token = await getTellerToken();
    if (!token) {
      return false;
    }

    try {
      // Test by fetching accounts
      await this.fetchAccounts(token);
      return true;
    } catch (error) {
      console.error("Teller config validation failed:", error instanceof Error ? error.message : error);
      return false;
    }
  }

  /**
   * Main sync implementation
   */
  protected async doSync(progress: SyncProgress): Promise<SyncProgress> {
    const token = await getTellerToken();
    if (!token) {
      progress.errors.push("Teller access token not found in keychain");
      return progress;
    }

    try {
      // Fetch all accounts
      const accounts = await this.fetchAccounts(token);
      progress.itemsFound = accounts.length;
      this.updateProgress(progress);

      // Determine date range for incremental sync
      const lastSyncDate = await this.getLastSyncTime();
      const fromDate = lastSyncDate
        ? this.formatDate(lastSyncDate)
        : this.getDefaultStartDate();

      // Process each account
      for (const account of accounts) {
        try {
          await this.syncAccount(account, token, fromDate, progress);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          progress.errors.push(`Failed to sync account ${account.id}: ${errorMessage}`);
          this.updateProgress(progress);
        }
      }

      return progress;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      progress.errors.push(`Failed to sync Teller: ${errorMessage}`);
      return progress;
    }
  }

  /**
   * Sync a single account and its transactions
   */
  private async syncAccount(
    account: TellerAccount,
    token: string,
    fromDate: string,
    progress: SyncProgress
  ): Promise<void> {
    // Fetch transactions for this account
    const transactions = await this.fetchTransactions(token, account.id, fromDate);

    for (const transaction of transactions) {
      try {
        await this.saveTransaction(account, transaction, progress);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        progress.errors.push(
          `Failed to save transaction ${transaction.id}: ${errorMessage}`
        );
      }
    }

    this.updateProgress(progress);
  }

  /**
   * Save a transaction as a TimelineItem
   */
  private async saveTransaction(
    account: TellerAccount,
    transaction: TellerTransaction,
    progress: SyncProgress
  ): Promise<void> {
    // Format amount (can be negative for debits)
    const amount = parseFloat(transaction.amount);
    const amountFormatted = amount < 0
      ? `-$${Math.abs(amount).toFixed(2)}`
      : `+$${amount.toFixed(2)}`;

    // Create title with description and amount
    const title = `${transaction.description} ${amountFormatted}`;

    // Create rich content with transaction details
    const content = this.formatTransactionContent(account, transaction);

    // Parse transaction date
    const transactionDate = new Date(transaction.date);

    // Get existing item to preserve ID if updating
    const existingItem = await this.getExistingItem(transaction.id);

    const item: TimelineItem = {
      id: existingItem?.id || crypto.randomUUID(),
      source: "teller",
      type: "transaction",
      externalId: transaction.id,
      title,
      content,
      rawData: {
        account: {
          id: account.id,
          name: account.name,
          type: account.type,
          institution: account.institution,
          last_four: account.last_four,
        },
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          date: transaction.date,
          description: transaction.description,
          category: transaction.category,
          merchant: transaction.merchant,
          status: transaction.status,
          running_balance: transaction.running_balance,
        },
      } as unknown as Record<string, unknown>,
      url: null,
      timestamp: transactionDate,
      createdAt: existingItem?.createdAt || new Date(),
      updatedAt: new Date(),
      syncStatus: "synced",
    };

    await this.saveItem(item);
  }

  /**
   * Format transaction content with details
   */
  private formatTransactionContent(
    account: TellerAccount,
    transaction: TellerTransaction
  ): string {
    const lines: string[] = [];

    lines.push(`**Account:** ${account.name} (...${account.last_four})`);
    lines.push(`**Institution:** ${account.institution.name}`);
    lines.push(`**Amount:** ${transaction.amount}`);
    lines.push(`**Date:** ${transaction.date}`);
    lines.push(`**Description:** ${transaction.description}`);

    if (transaction.category) {
      lines.push(`**Category:** ${transaction.category}`);
    }

    if (transaction.merchant?.name) {
      lines.push(`**Merchant:** ${transaction.merchant.name}`);
    }

    lines.push(`**Status:** ${transaction.status}`);

    if (transaction.running_balance) {
      lines.push(`**Running Balance:** ${transaction.running_balance}`);
    }

    if (transaction.type) {
      lines.push(`**Type:** ${transaction.type}`);
    }

    return lines.join("\n");
  }

  /**
   * Get existing item from database by transaction ID
   */
  private async getExistingItem(transactionId: string): Promise<TimelineItem | null> {
    const { timelineItems } = await import("../../db/schema.js");
    const { eq, and } = await import("drizzle-orm");

    const result = await this.db.query.timelineItems.findFirst({
      where: and(
        eq(timelineItems.source, "teller"),
        eq(timelineItems.externalId, transactionId)
      ),
    });

    if (!result) return null;

    return {
      id: result.id,
      source: result.source as SourceType,
      type: result.type as TimelineItem["type"],
      externalId: result.externalId || undefined,
      title: result.title || undefined,
      content: result.content || undefined,
      rawData: result.rawData ? JSON.parse(result.rawData) : undefined,
      url: result.url || undefined,
      timestamp: result.timestamp,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      syncStatus: result.syncStatus as TimelineItem["syncStatus"],
      errorMessage: result.errorMessage || undefined,
    };
  }

  /**
   * Fetch all accounts from Teller API
   */
  async fetchAccounts(token: string): Promise<TellerAccount[]> {
    const response = await fetch(`${this.baseUrl}/accounts`, {
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    return response.json();
  }

  /**
   * Fetch transactions for an account
   */
  async fetchTransactions(
    token: string,
    accountId: string,
    fromDate?: string
  ): Promise<TellerTransaction[]> {
    let url = `${this.baseUrl}/accounts/${accountId}/transactions`;

    // Add date range for incremental sync
    if (fromDate) {
      url += `?from=${fromDate}`;
    }

    const response = await fetch(url, {
      headers: this.getAuthHeaders(token),
    });

    if (!response.ok) {
      await this.handleApiError(response);
    }

    return response.json();
  }

  /**
   * Get authentication headers for API requests
   * Teller uses Basic auth with token as username and no password
   */
  private getAuthHeaders(token: string): Record<string, string> {
    const credentials = Buffer.from(`${token}:`).toString("base64");
    return {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Handle API errors with specific error messages
   */
  private async handleApiError(response: Response): Promise<never> {
    const status = response.status;
    let message: string;

    switch (status) {
      case 401:
        message = "Teller access token is invalid or expired. Please re-authenticate.";
        break;
      case 403:
        message = "Teller access token does not have permission for this operation.";
        break;
      case 404:
        message = "Teller resource not found.";
        break;
      case 429:
        message = "Teller API rate limit exceeded. Please try again later.";
        break;
      default:
        try {
          const errorBody = await response.json();
          message = errorBody?.error?.message || `Teller API error: ${response.statusText}`;
        } catch {
          message = `Teller API error: ${response.status} ${response.statusText}`;
        }
    }

    throw new Error(message);
  }

  /**
   * Format date for Teller API (YYYY-MM-DD)
   */
  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }

  /**
   * Get default start date (90 days ago)
   */
  private getDefaultStartDate(): string {
    const date = new Date();
    date.setDate(date.getDate() - 90);
    return this.formatDate(date);
  }
}
