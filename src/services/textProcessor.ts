export interface TextSegment {
  type: 'sentence' | 'list-item' | 'enumeration';
  content: string;
  pauseAfter?: number; // Custom pause duration in milliseconds
}

export class TextProcessor {
  private static readonly DEFAULT_PAUSE = 300; // Reduced pause
  private static readonly LIST_PAUSE = 500;
  private static readonly ENUMERATION_PAUSE = 400;

  public static processText(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    // Split by paragraphs first
    const paragraphs = text.split(/\n\s*\n/);
    
    for (const paragraph of paragraphs) {
      if (!paragraph.trim()) continue;

      // Handle lists
      if (paragraph.match(/^[\s]*[•\-\*][\s]+/m)) {
        segments.push({
          type: 'list-item',
          content: paragraph.trim(),
          pauseAfter: this.LIST_PAUSE
        });
        continue;
      }

      // Handle enumeration
      if (paragraph.match(/^[\s]*[a-z][\.)]\s+/i)) {
        segments.push({
          type: 'enumeration',
          content: paragraph.trim(),
          pauseAfter: this.ENUMERATION_PAUSE
        });
        continue;
      }

      // Handle longer sentences by splitting on major punctuation
      const sentences = paragraph
        .split(/(?<=[.!?])\s+(?=[A-Z])/)
        .filter(s => s.trim().length > 0)
        .map(s => ({
          type: 'sentence' as const,
          content: s.trim(),
          pauseAfter: this.DEFAULT_PAUSE
        }));
      
      segments.push(...sentences);
    }

    return segments;
  }

  public static getSegmentText(segments: TextSegment[], startIndex: number, endIndex: number): string {
    return segments
      .slice(startIndex, endIndex + 1)
      .map(segment => segment.content)
      .join(' ');
  }
}
