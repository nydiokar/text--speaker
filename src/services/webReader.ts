import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebReader {
  public static async read(url: string): Promise<string> {
    try {
      console.log('Fetching content from:', url);
      
      // First check if it's a Google Doc
      if (url.includes('docs.google.com')) {
        return await WebReader.readGoogleDoc(url);
      }

      // Original web scraping logic remains intact
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Enhanced content extraction
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('header').remove();
      $('footer').remove();
      $('iframe').remove();
      $('.advertisement').remove();
      $('.ads').remove();

      // Try to get the main content first
      let content = WebReader.extractMainContent($);

      // If no main content found, fall back to body text
      if (!content.trim()) {
        content = $('body').text();
      }

      // Clean up the text
      return WebReader.cleanupText(content);
    } catch (error) {
      console.error('Failed to read web page:', error);
      throw new Error(`Failed to read web page: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private static extractMainContent($: cheerio.CheerioAPI): string {
    const possibleContentSelectors = [
      'article',
      '[role="main"]',
      '.main-content',
      '#main-content',
      '.post-content',
      '.article-content',
      'main',
      '.entry-content',
      '#content'
    ];

    for (const selector of possibleContentSelectors) {
      const element = $(selector);
      if (element.length) {
        return element.text();
      }
    }

    return '';
  }

  private static cleanupText(text: string): string {
    return text
      .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Replace multiple newlines with double newline
      .replace(/\t/g, ' ')         // Replace tabs with spaces
      .trim();
  }

  // Google Docs specific methods
  private static async readGoogleDoc(url: string): Promise<string> {
    try {
      // Convert viewing URL to export URL
      const docId = WebReader.extractGoogleDocId(url);
      if (!docId) {
        throw new Error('Invalid Google Docs URL');
      }

      const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;
      console.log('Fetching Google Doc from:', exportUrl);

      const response = await axios.get(exportUrl, {
        responseType: 'text',
        headers: {
          'Accept': 'text/plain'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to read Google Doc:', error);
      throw new Error('Failed to read Google Doc. Make sure the document is publicly accessible.');
    }
  }

  private static extractGoogleDocId(url: string): string | null {
    // Handle different Google Docs URL formats
    const patterns = [
      /\/document\/d\/([a-zA-Z0-9-_]+)/,
      /\/document\/u\/\d+\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }
}
