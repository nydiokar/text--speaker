import axios from 'axios';
import * as cheerio from 'cheerio';

export class WebReader {
  public async readWebPage(url: string): Promise<string> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Remove script and style elements
      $('script').remove();
      $('style').remove();
      $('header').remove();
      $('nav').remove();
      $('footer').remove();

      // Get the main content (prefer article or main elements)
      let content = $('article').text() || $('main').text();

      // If no article/main found, get body content
      if (!content.trim()) {
        content = $('body').text();
      }

      // Clean up the text
      return content
        .replace(/\s+/g, ' ')        // Replace multiple spaces with single space
        .replace(/\n+/g, '\n')       // Replace multiple newlines with single newline
        .trim();                     // Remove leading/trailing whitespace

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
