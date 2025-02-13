export interface TextSegment {
  type: 'sentence' | 'list-item' | 'enumeration';
  content: string;
  pauseAfter?: number; // Custom pause duration in milliseconds
}

export class TextProcessor {
  private static readonly SENTENCE_PAUSE = 500; // ms pause after sentences
  private static readonly COMMA_PAUSE = 200;    // ms pause after commas
  private static readonly LIST_PAUSE = 500;     // ms pause after list items
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

      // Split into sentences and add pauses
      const sentences = paragraph
        .split(/([.!?]+)(?=\s+|$)/)  // Split keeping the punctuation
        .reduce((acc: string[], part) => {
          if (part.match(/[.!?]+/)) {
            // Combine punctuation with previous part
            acc[acc.length - 1] += part;
          } else if (part.trim()) {
            // Split by commas and add pauses
            const commaParts = part.split(/([,])(?=\s+|$)/);
            commaParts.forEach(commaPart => {
              if (commaPart === ',') {
                acc[acc.length - 1] += commaPart;
              } else if (commaPart.trim()) {
                acc.push(commaPart.trim());
              }
            });
          }
          return acc;
        }, [])
        .filter(s => s.trim())
        .map(s => ({
          type: 'sentence' as const,
          content: s.trim(),
          pauseAfter: s.match(/[.!?]+$/) ? this.SENTENCE_PAUSE : this.COMMA_PAUSE
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
