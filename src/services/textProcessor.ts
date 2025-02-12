export interface TextSegment {
  type: 'sentence' | 'list-item' | 'enumeration';
  content: string;
  pauseAfter?: number; // Custom pause duration in milliseconds
}

export class TextProcessor {
  private static readonly DEFAULT_PAUSE = 500;
  private static readonly LIST_PAUSE = 800;
  private static readonly ENUMERATION_PAUSE = 600;

  public static processText(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    const lines = text.split(/\n/);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle bullet points and numbered lists
      if (line.match(/^[\s]*[•\-\*][\s]+/)) {
        // Bullet point list
        segments.push({
          type: 'list-item',
          content: line.replace(/^[\s]*[•\-\*][\s]+/, '').trim(),
          pauseAfter: this.LIST_PAUSE
        });
      } else if (line.match(/^[\s]*\d+[\.)]\s+/)) {
        // Numbered list
        segments.push({
          type: 'list-item',
          content: line.replace(/^[\s]*\d+[\.)]\s+/, '').trim(),
          pauseAfter: this.LIST_PAUSE
        });
      } else if (line.match(/^[\s]*[a-z][\.)]\s+/i)) {
        // Alphabetical list
        segments.push({
          type: 'enumeration',
          content: line.replace(/^[\s]*[a-z][\.)]\s+/i, '').trim(),
          pauseAfter: this.ENUMERATION_PAUSE
        });
      } else {
        // Regular sentences
        const sentenceSegments = line
          .replace(/([.?!])\s+/g, '$1|')
          .split('|')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map(s => ({
            type: 'sentence' as const,
            content: s,
            pauseAfter: this.DEFAULT_PAUSE
          }));
        
        segments.push(...sentenceSegments);
      }
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
