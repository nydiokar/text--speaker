import { readFile } from 'fs/promises';
import { extname } from 'path';

export class FileReader {
  private static readonly SUPPORTED_EXTENSIONS = new Set(['.txt', '.md']);

  public async readTextFile(filePath: string): Promise<string> {
    const extension = extname(filePath).toLowerCase();
    
    if (!FileReader.SUPPORTED_EXTENSIONS.has(extension)) {
      throw new Error(`Unsupported file type: ${extension}. Supported types are: ${Array.from(FileReader.SUPPORTED_EXTENSIONS).join(', ')}`);
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
