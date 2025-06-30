import { Integration, IntegrationConfig } from '../types/integrations';
import { notionService } from '../notion/notionService';
import { notionDataFormatter } from '../notion/notionDataFormatter';
import { AIContact } from '../../../core/types/types';

// In-memory cache for integration data
const integrationDataCache: Record<string, {
  data: any;
  timestamp: Date;
  summary: string;
}> = {};

class IntegrationsService {
  /**
   * Execute an integration and return the result
   */
  async executeIntegration(integration: Integration, config: IntegrationConfig): Promise<any> {
    try {
      console.log(`🔄 Executing integration: ${integration.name}`);
      
      switch (integration.id) {
        case 'http-requests':
          return await this.executeHttpRequest(config);
        case 'google-news':
          return await this.executeGoogleNews(config);
        case 'rss-feeds':
          return await this.executeRssFeeds(config);
        case 'financial-markets':
          return await this.executeFinancialMarkets(config);
        case 'notion-oauth-source':
          return await this.executeNotionSource(config);
        default:
          throw new Error(`Integration ${integration.id} not implemented`);
      }
    } catch (error) {
      console.error(`❌ Integration execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Store integration data in cache
   */
  storeIntegrationData(contactId: string, integrationId: string, data: any, summary: string): void {
    const cacheKey = `${contactId}:${integrationId}`;
    integrationDataCache[cacheKey] = {
      data,
      timestamp: new Date(),
      summary
    };
    console.log(`💾 Stored integration data for ${integrationId}`);
  }

  /**
   * Get integration data from cache
   */
  getIntegrationData(contactId: string, integrationId: string): {
    data: any;
    timestamp: Date;
    summary: string;
  } | null {
    const cacheKey = `${contactId}:${integrationId}`;
    return integrationDataCache[cacheKey] || null;
  }

  /**
   * Clear integration data from cache
   */
  clearIntegrationData(contactId: string, integrationId: string): void {
    const cacheKey = `${contactId}:${integrationId}`;
    delete integrationDataCache[cacheKey];
    console.log(`🧹 Cleared integration data for ${integrationId}`);
  }

  /**
   * Start periodic execution of an integration for a contact
   */
  startPeriodicExecution(
    contactId: string, 
    integration: Integration, 
    config: IntegrationConfig, 
    onUpdate: (contactId: string, data: any) => void
  ): void {
    // For now, just execute once immediately if it's a periodic integration
    // In a real implementation, you'd set up an interval based on config.interval
    if (config.enabled && integration.category !== 'action') {
      setTimeout(async () => {
        try {
          const data = await this.executeIntegration(integration, config);
          this.storeIntegrationData(contactId, integration.id, data, `Data from ${integration.name}`);
          onUpdate(contactId, data);
                 } catch (error) {
           console.error(`❌ Periodic execution failed for ${integration.name}:`, error instanceof Error ? error.message : 'Unknown error');
        }
      }, 1000); // Execute after 1 second
    }
  }

  /**
   * Stop periodic execution of an integration for a contact
   */
  stopPeriodicExecution(contactId: string, integrationId: string): void {
    console.log(`⏹️ Stopping periodic execution for integration ${integrationId} on contact ${contactId}`);
    // In a real implementation, you'd clear the interval here
  }

  /**
   * Execute HTTP request integration
   */
  private async executeHttpRequest(config: IntegrationConfig): Promise<any> {
    const { url, method = 'GET', headers = '{}', body } = config.settings;
    
    if (!url) {
      throw new Error('URL is required');
    }

    let parsedHeaders = {};
    try {
      parsedHeaders = JSON.parse(headers);
    } catch (e) {
      console.warn('Invalid headers JSON, using empty headers');
    }

    const options: RequestInit = {
      method,
      headers: parsedHeaders
    };

    if (body && (method === 'POST' || method === 'PUT')) {
      options.body = body;
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      throw new Error(`HTTP request failed: ${response.status} ${response.statusText}`);
    }

    try {
      return await response.json();
    } catch (e) {
      return await response.text();
    }
  }

  /**
   * Execute Google News integration
   */
  private async executeGoogleNews(config: IntegrationConfig): Promise<any> {
    const { topic = 'technology', country = 'US', language = 'en' } = config.settings;
    
    // Use a free news API
    const url = `https://newsapi.org/v2/top-headlines?q=${encodeURIComponent(topic)}&country=${country.toLowerCase()}&language=${language}&apiKey=sample-key`;
    
    // For demo purposes, return mock data
    return {
      status: "ok",
      totalResults: 10,
      articles: [
        {
          source: { id: "techcrunch", name: "TechCrunch" },
          author: "John Smith",
          title: `Latest ${topic} news from ${country}`,
          description: "This is a sample news article about technology.",
          url: "https://techcrunch.com/sample-article",
          publishedAt: new Date().toISOString()
        },
        {
          source: { id: "wired", name: "Wired" },
          author: "Jane Doe",
          title: `Breaking: New developments in ${topic}`,
          description: "Another sample news article about technology.",
          url: "https://wired.com/sample-article",
          publishedAt: new Date().toISOString()
        }
      ]
    };
  }

  /**
   * Execute RSS Feeds integration
   */
  private async executeRssFeeds(config: IntegrationConfig): Promise<any> {
    const { feedUrl, maxItems = 10 } = config.settings;
    
    if (!feedUrl) {
      throw new Error('Feed URL is required');
    }

    // For demo purposes, return mock data
    return {
      title: "Sample RSS Feed",
      description: "This is a sample RSS feed",
      link: feedUrl,
      items: Array.from({ length: Math.min(parseInt(maxItems), 20) }, (_, i) => ({
        title: `Sample RSS Item ${i + 1}`,
        link: `${feedUrl}/item/${i + 1}`,
        pubDate: new Date().toISOString(),
        content: `This is the content of RSS item ${i + 1}`
      }))
    };
  }

  /**
   * Execute Financial Markets integration
   */
  private async executeFinancialMarkets(config: IntegrationConfig): Promise<any> {
    const { dataType = 'crypto', symbols = 'bitcoin,ethereum', currency = 'usd' } = config.settings;
    
    // For demo purposes, return mock data
    if (dataType === 'crypto') {
      const symbolList = symbols.split(',').map(s => s.trim());
      return {
        prices: symbolList.map(symbol => ({
          symbol,
          price: Math.random() * 50000,
          change_24h: (Math.random() * 10) - 5,
          market_cap: Math.random() * 1000000000000,
          last_updated: new Date().toISOString()
        }))
      };
    } else if (dataType === 'stocks') {
      const symbolList = symbols.split(',').map(s => s.trim());
      return {
        prices: symbolList.map(symbol => ({
          symbol,
          price: Math.random() * 1000,
          change_percent: (Math.random() * 10) - 5,
          volume: Math.random() * 10000000,
          last_updated: new Date().toISOString()
        }))
      };
    } else {
      throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  /**
   * Execute Notion Source integration
   */
  private async executeNotionSource(config: IntegrationConfig): Promise<any> {
    // This would normally use the Notion API, but for demo purposes, return mock data
    return {
      pages: [
        { id: "page1", title: "Meeting Notes", lastEdited: "2 days ago" },
        { id: "page2", title: "Project Plan", lastEdited: "yesterday" },
        { id: "page3", title: "Ideas", lastEdited: "just now" }
      ],
      databases: [
        { id: "db1", name: "Tasks", entryCount: 24 },
        { id: "db2", name: "Projects", entryCount: 5 },
        { id: "db3", name: "Team Members", entryCount: 12 }
      ]
    };
  }

  /**
   * Execute API request tool
   */
  async executeApiRequest(url: string, method: string = 'GET', headers: any = {}, body?: string): Promise<any> {
    try {
      console.log(`🌐 Executing API request: ${method} ${url}`);
      
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = body;
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      try {
        return await response.json();
      } catch (e) {
        return await response.text();
      }
    } catch (error) {
      console.error(`❌ API request failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute webhook trigger tool - Now using Supabase Edge Function to avoid CORS issues
   */
  async executeWebhookTriggerTool(
    webhookUrl: string,
    payload: string,
    headers: any = {},
    userMessage: string,
    contactName?: string
  ): Promise<any> {
    try {
      console.log(`🪝 Executing webhook trigger: ${webhookUrl}`);
      
      // Process dynamic variables in payload
      let processedPayload = payload
        .replace(/{{timestamp}}/g, new Date().toISOString())
        .replace(/{{user_message}}/g, userMessage)
        .replace(/{{contact_name}}/g, contactName || 'AI Assistant');
      
      // Parse the payload as JSON
      let payloadObj;
      try {
        payloadObj = JSON.parse(processedPayload);
      } catch (e) {
        console.warn('Invalid payload JSON, using empty object');
        payloadObj = {};
      }

      // Get Supabase URL from environment
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL is not defined in environment variables');
      }

      // Use Supabase Edge Function as a proxy to avoid CORS issues
      const proxyUrl = `${supabaseUrl}/functions/v1/trigger-external-webhook`;
      
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          webhookUrl,
          payload: payloadObj,
          headers
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Webhook proxy failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      return {
        success: result.success,
        status: result.status,
        data: result.data
      };
    } catch (error) {
      console.error(`❌ Webhook trigger failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute Notion tool operation
   */
  async executeNotionToolOperation(
    operation: string,
    query?: string,
    pageId?: string,
    databaseId?: string,
    title?: string,
    content?: string,
    parentId?: string,
    properties?: any,
    filter?: any,
    sorts?: any[],
    contact?: AIContact
  ): Promise<any> {
    try {
      console.log(`📝 Executing Notion operation: ${operation}`);
      
      // Get user ID from contact
      const userId = contact?.id.split('_')[0];
      if (!userId) {
        throw new Error('User ID not found');
      }

      // Get Notion credentials
      const clientId = import.meta.env.VITE_NOTION_CLIENT_ID;
      const clientSecret = import.meta.env.VITE_NOTION_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        throw new Error('Notion credentials not configured');
      }

      switch (operation) {
        case 'search_pages':
          return await notionService.searchPages(userId, clientId, clientSecret, query || '');
          
        case 'search_databases':
          return await notionService.searchDatabases(userId, clientId, clientSecret, query || '');
          
        case 'get_page_content':
          if (!pageId) {
            throw new Error('Page ID is required');
          }
          return await notionService.getPageContent(userId, clientId, clientSecret, pageId);
          
        case 'create_page':
          if (!parentId) {
            throw new Error('Parent ID is required');
          }
          if (!title) {
            throw new Error('Title is required');
          }
          return await notionService.createPage(userId, clientId, clientSecret, parentId, title, content);
          
        case 'update_page':
          if (!pageId) {
            throw new Error('Page ID is required');
          }
          if (!properties) {
            throw new Error('Properties are required');
          }
          return await notionService.updatePage(userId, clientId, clientSecret, pageId, properties);
          
        case 'query_database':
          if (!databaseId) {
            throw new Error('Database ID is required');
          }
          
          // First try to search for database by name if it's not a UUID
          if (databaseId.length < 36) {
            console.log(`🔍 Searching for database by name: ${databaseId}`);
            const databases = await notionService.searchDatabases(userId, clientId, clientSecret, databaseId);
            
            if (databases && databases.length > 0) {
              // Find the best match by name
              const bestMatch = databases.find(db => 
                db.title.toLowerCase() === databaseId.toLowerCase()
              ) || databases[0];
              
              console.log(`✅ Found database: ${bestMatch.title} (${bestMatch.id})`);
              databaseId = bestMatch.id;
            } else {
              throw new Error(`Database "${databaseId}" not found`);
            }
          }
          
          const results = await notionService.queryDatabase(userId, clientId, clientSecret, databaseId, filter, sorts);
          
          // Format results for better readability
          return notionDataFormatter.formatDatabaseQueryResults(results, databaseId);
          
        default:
          throw new Error(`Unsupported Notion operation: ${operation}`);
      }
    } catch (error) {
      console.error(`❌ Notion operation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute Google Sheets tool operation
   */
  async executeGoogleSheetsToolOperation(
    operation: string,
    sheetUrl: string,
    accessLevel: string = 'read-only',
    sheetName: string = 'Sheet1',
    range?: string,
    data?: any[][],
    searchTerm?: string
  ): Promise<any> {
    try {
      console.log(`📊 Executing Google Sheets operation: ${operation}`);
      
      // Extract sheet ID from URL
      const sheetId = this.extractSheetId(sheetUrl);
      if (!sheetId) {
        throw new Error('Invalid Google Sheet URL');
      }

      // Check access level for write operations
      if ((operation === 'write' || operation === 'append' || operation === 'clear') && accessLevel !== 'read-write') {
        throw new Error(`Operation "${operation}" requires read-write access level`);
      }

      // For demo purposes, return mock data
      switch (operation) {
        case 'read':
          return {
            operation,
            sheetName,
            range: range || 'A1:D10',
            data: this.generateMockSheetData(5, 4)
          };
          
        case 'write':
          return {
            operation,
            sheetName,
            range: range || 'A1:D5',
            updatedCells: data ? data.length * data[0].length : 20,
            success: true
          };
          
        case 'append':
          return {
            operation,
            sheetName,
            appendedRows: data ? data.length : 1,
            success: true
          };
          
        case 'search':
          return {
            operation,
            sheetName,
            searchTerm,
            results: [
              { row: 2, data: ['John', 'Doe', 'john@example.com', '555-1234'] },
              { row: 5, data: ['Jane', 'Doe', 'jane@example.com', '555-5678'] }
            ]
          };
          
        case 'info':
          return {
            operation,
            sheetName,
            sheetId,
            title: 'Sample Spreadsheet',
            sheets: ['Sheet1', 'Sheet2', 'Data'],
            columns: ['Name', 'Email', 'Phone', 'Status'],
            rowCount: 100,
            columnCount: 10
          };
          
        case 'clear':
          return {
            operation,
            sheetName,
            range: range || 'A1:D10',
            clearedCells: 40,
            success: true
          };
          
        default:
          throw new Error(`Unsupported Google Sheets operation: ${operation}`);
      }
    } catch (error) {
      console.error(`❌ Google Sheets operation failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract Google Sheet ID from URL
   */
  private extractSheetId(url: string): string | null {
    const regex = /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Generate mock sheet data for demo purposes
   */
  private generateMockSheetData(rows: number, cols: number): string[][] {
    const headers = ['Name', 'Email', 'Phone', 'Status', 'Date', 'Amount'];
    const statuses = ['Active', 'Pending', 'Completed', 'Cancelled'];
    
    const data: string[][] = [headers.slice(0, cols)];
    
    for (let i = 0; i < rows - 1; i++) {
      const row: string[] = [];
      row.push(`Person ${i + 1}`);
      row.push(`person${i + 1}@example.com`);
      row.push(`555-${1000 + i}`);
      if (cols > 3) row.push(statuses[Math.floor(Math.random() * statuses.length)]);
      if (cols > 4) row.push(new Date().toLocaleDateString());
      if (cols > 5) row.push(`$${(Math.random() * 1000).toFixed(2)}`);
      
      data.push(row.slice(0, cols));
    }
    
    return data;
  }
}

export const integrationsService = new IntegrationsService();