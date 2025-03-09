export interface TextSegment {
  type: 'sentence' | 'list-item' | 'enumeration' | 'definition';
  content: string;
  pauseAfter?: number; // Custom pause duration in milliseconds
  definitionKey?: string; // Key to lookup the definition
  definition?: string; // The full definition text
  isDefinable?: boolean; // Indicates if this segment can be interrupted for definition
}

interface DefinitionMap {
  [key: string]: string;
}

export class TextProcessor {
  private static readonly SENTENCE_PAUSE = 500; // ms pause after sentences
  private static readonly COMMA_PAUSE = 200;    // ms pause after commas
  private static readonly LIST_PAUSE = 500;     // ms pause after list items
  private static readonly ENUMERATION_PAUSE = 400;
  private static readonly DEFINITION_PAUSE = 300; // ms pause after definitions

  // Regex patterns for detecting hyperlinks and definitions
  private static readonly HYPERLINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
  private static readonly DEFINITION_PATTERN = /\{\{([^}]+)\}\}/g;

  private static extractDefinitions(text: string): [string, DefinitionMap] {
    const definitions: DefinitionMap = {};
    
    // Replace hyperlinks with their text content and store definitions
    text = text.replace(this.HYPERLINK_PATTERN, (_, text, url) => {
      const key = `def_${Object.keys(definitions).length}`;
      definitions[key] = `Link to: ${url}`;
      return `{{${text}}}`;
    });

    return [text, definitions];
  }

  public static processText(text: string): TextSegment[] {
    const segments: TextSegment[] = [];
    
    // Extract definitions and clean text
    const [processedText, definitions] = this.extractDefinitions(text);
    
    // Split by paragraphs first
    const paragraphs = processedText.split(/\n\s*\n/);
    
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
        .map(part => {
          // Process definitions within sentences
          const definedPart = part.replace(this.DEFINITION_PATTERN, (match, word) => {
            const key = `def_${Object.keys(definitions).length}`;
            if (!definitions[key]) {
              definitions[key] = `Definition requested for: ${word}`;
            }
            return word;  // Remove the definition markers but keep the word
          });
          return definedPart;
        })
        .reduce((acc: string[], part: string) => {
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
        .map(s => {
          const segment: TextSegment = {
            type: 'sentence' as const,
            content: s.trim(),
            pauseAfter: s.match(/[.!?]+$/) ? this.SENTENCE_PAUSE : this.COMMA_PAUSE
          };

          // Check if this segment contains definable content
          if (s.includes('{{') || s.includes('[')) {
            segment.isDefinable = true;
            // Extract the word that can be defined
            const match = s.match(this.DEFINITION_PATTERN);
            if (match) {
              const word = match[0].replace(/[{}]/g, '').trim();
              segment.definitionKey = `def_${Object.keys(definitions).length - 1}`;
              segment.definition = definitions[segment.definitionKey];
            }
          }

          return segment;
        });

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
