import axios from 'axios';
import * as cheerio from 'cheerio';
import { Element } from 'domhandler';

export class WebReader {
  public async readWebPage(url: string): Promise<string> {
    try {
      console.log('Fetching webpage:', url);
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // First pass: Remove all unwanted elements
      $('script, style, link, meta, noscript, iframe, img, svg, head').remove();
      $('.comments, .comment, .ad, .advertisement, .social-share, .navigation, .nav, .menu, .footer, .header').remove();
      $('header, footer, nav, aside').remove();
      $('code, pre').remove();

      // Clean text content
      const cleanText = (text: string): string => {
        return text
          .replace(/[|=*_]{3,}/g, '. ') // Replace separators with periods
          .replace(/\.{3,}/g, '...') // Normalize ellipsis
          .replace(/[\t\r\f\v]/g, ' ') // Convert tabs and other whitespace to spaces
          .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
          .replace(/\s{2,}/g, ' ') // Normalize spaces
          .trim();
      };

      // Process content by type
      const processElement = (el: Element): string => {
        const $el = $(el);
        const tag = el.tagName.toLowerCase();
        const text = $el.text().trim();

        if (!text) return '';

        switch (tag) {
          case 'h1':
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            return `\n${cleanText(text)}.\n`;
          
          case 'li':
            return `• ${cleanText(text)}.\n`;
          
          case 'p':
            const cleaned = cleanText(text);
            return cleaned.endsWith('.') ? `${cleaned}\n` : `${cleaned}.\n`;
          
          default:
            return cleanText(text) + '\n';
        }
      };

      // Find main content container
      const mainSelectors = [
        'article',
        'main',
        '[role="main"]',
        '.content',
        '.post-content',
        '.article-content',
        '.entry-content',
        '#content'
      ];

      let $mainContent = $();
      for (const selector of mainSelectors) {
        $mainContent = $(selector);
        if ($mainContent.length > 0) break;
      }

      // Fallback to body if no main content found
      if ($mainContent.length === 0) {
        $mainContent = $('body');
      }

      // Process elements in order
      const contentParts: string[] = [];
      $mainContent.find('h1, h2, h3, h4, h5, h6, p, li').each((_, el) => {
        const processedText = processElement(el);
        if (processedText.trim()) {
          contentParts.push(processedText);
        }
      });

      const finalText = contentParts
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      console.log('Processed web content length:', finalText.length);
      return finalText;

    } catch (error) {
      throw new Error(`Failed to read webpage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}
