# Speaker AI

A command-line text-to-speech application that uses Windows' built-in speech synthesis capabilities to read text files, web content, or direct input aloud.

## Features

- Read text files (.txt, .md) aloud
- Convert direct text input to speech
- Read web content with smart content extraction
- Read Google Docs (public documents)
- Interactive progress bar with time estimation
- Uses native Windows text-to-speech engine
- Smart text processing with natural pauses
- Simple command-line interface
- Batch processing for efficient playback - currently set at 3 
- Interactive playback controls
- Error handling and recovery

## Prerequisites

- Windows operating system (uses Windows built-in speech synthesis)
- Node.js installed
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nydiokar/text--speaker.git
cd speaker-ai
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

The application can be used in two ways:

### 1. Interactive Menu Mode

Simply run the application without any arguments:
```bash
npm run start 
```

### 2. Command Line Mode

The application supports direct command-line usage with the following commands:

#### Read a Text File

```bash
npm run start speak <file-path>
```

Example:
```bash
npm run start speak test.txt
```

Supported file formats:
- .txt
- .md

#### Read Direct Text Input

```bash
npm run start say "<text>"
```

Example:
```bash
npm run start say "Hello, this is a test message"
```

#### Read Web Content

To read content from a webpage:

```bash
npm run start <url>
```

Example:
```bash
npm run start https://github.com/nydiokar/text--speaker/blob/master/README.md
```

The command will:
- Fetch the webpage
- Extract the main content (excluding navigation, headers, footers, etc.)
- Clean up the content for better readability
- Read it aloud with progress tracking

#### Read Google Docs

To read content from a Google Doc (must be publicly accessible):

```bash
npm run start read-web "https://docs.google.com/document/d/[document-id]"
```

The application automatically detects Google Doc URLs and uses the appropriate extraction method.

#### List Available Voices

To see all available text-to-speech voices on your system:

```bash
npm run start voices
```

This will display a list of all installed voices with their names, cultures, and genders.

#### Voice Selection

You can specify a different voice for any read command using the `-v` or `--voice` option:

```bash
# Use a specific voice for reading text
npm run start say "Hello World" --voice "Microsoft David"

# Use a specific voice for reading files
npm run start speak test.txt --voice "Microsoft Zira"
```

### Interactive Playback Controls

When you start reading content, the application enters interactive mode with the following keyboard controls:

```
[space]    - Pause/Resume playback
[←] or [b] - Rewind to previous sentence
[→] or [f] - Forward to next sentence
[r]        - Replay current sentence
[q]        - Quit playback
[Ctrl+C]   - Force quit
```

The interactive mode provides:
- Real-time progress bar showing reading progress
- Estimated time remaining
- Segment count and percentage complete
- Immediate feedback on navigation
- Clean playback control

### Progress Tracking

During playback, you'll see:
- A visual progress bar
- Current segment / total segments
- Percentage complete
- Estimated time remaining
- Time elapsed

The progress bar updates in real-time and accurately reflects:
- Pauses and resumes
- Forward/backward navigation
- Current position in content

### Smart Text Processing

The application includes intelligent pause timing for different types of content:

- Standard sentences: 500ms pause after each sentence
- List items (bullet points): 500ms pause after each item
- Enumerated items: 400ms pause after each item
- Commas: 200ms pause

This creates a more natural reading experience for:
- Bullet-point lists (•, -, *)
- Numbered lists (1., 2., etc.)
- Alphabetical lists (a., b., etc.)
- Regular sentences with proper pauses at punctuation marks

## Technical Details

The application is built with:
- TypeScript for type safety
- Commander.js for CLI interface
- Windows PowerShell for text-to-speech
- Axios for web content fetching
- Cheerio for content extraction
- Batch processing for efficient playback

## Development

Available npm scripts:
- `npm run build` - Compiles TypeScript to JavaScript
- `npm run start` - Runs the compiled application
- `npm run dev` - Runs the application with ts-node
- `npm test` - Runs the Mocha test suite

## Troubleshooting

If you encounter issues:

1. Ensure you're running on a Windows system
2. Check if Windows Text-to-Speech is enabled
3. Verify file permissions for text files
4. Ensure PowerShell execution is allowed
5. Check internet connectivity for web content
6. Verify Google Doc sharing settings if applicable

## Future Improvements

Planned enhancements:
- Cross-platform support
- Additional file format support
- Speech rate and pitch controls
- Custom voice profiles
- Reading list management
- Advanced text preprocessing
- Cloud-based TTS integration

## License

ISC License
