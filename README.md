# Speaker AI

A simple command-line text-to-speech application that uses Windows' built-in speech synthesis capabilities to read text files or direct input aloud.

## Features

- Read text files (.txt, .md) aloud
- Convert direct text input to speech
- Uses native Windows text-to-speech engine
- Simple command-line interface
- Error handling for unsupported file types

## Prerequisites

- Windows operating system (uses Windows built-in speech synthesis)
- Node.js installed
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
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

This will start an interactive menu where you can:
1. Choose what to read (file, web content, or direct text)
2. Input the necessary details (file path, URL, or text)
3. Optionally select a voice
4. Control playback using keyboard commands

### 2. Command Line Mode

The application also supports direct command-line usage with the following commands:

### 1. Read a Text File

```bash
npm run start speak <file-path>
```

Example:
```bash
npm run start speak test.txt
```

This command will read the contents of the specified text file aloud. Supported file formats are:
- .txt
- .md

### 2. Read Direct Text Input

```bash
npm run start say "<text>"
```

Example:
```bash
npm run start say "Hello, this is a test message"
```

### 3. List Available Voices

To see all available text-to-speech voices on your system:

```bash
npm run start voices
```

This will display a list of all installed voices with their names, cultures, and genders.

### 4. Interactive Playback Controls

When you start reading content (using `speak`, `say`, or `read-web`), the application enters interactive mode with the following keyboard controls:

```
[space]    - Pause/Resume playback
[←] or [b] - Rewind to previous sentence
[→] or [f] - Forward to next sentence
[r]        - Replay current sentence
[q]        - Quit playback
[Ctrl+C]   - Force quit
```

The interactive mode provides immediate feedback and control over the reading process. You can:
- Pause at any time with spacebar
- Navigate back and forth through sentences
- Replay sections you want to hear again
- Quit cleanly with 'q' or force quit with Ctrl+C

### 5. Read Web Page Content

To read content from a webpage:

```bash
npm run start read-web <url>
npm run start read-web <url>
```

Example:
```bash
npm run start read-web "https://example.com/article"
```

The command will fetch the webpage, extract the main content (excluding navigation, headers, footers, etc.), and read it aloud.

### 6. Stop Speech Synthesis

To stop the current speech synthesis at any time:

```bash
npm run start stop
```

This command will immediately stop any ongoing text-to-speech playback.

## Voice Selection

You can specify a different voice for any read command using the `-v` or `--voice` option:

```bash
# List available voices
npm run start voices

# Use a specific voice for reading text
npm run start say "Hello World" --voice "Microsoft David"

# Use a specific voice for reading files
npm run start speak test.txt --voice "Microsoft Zira"

# Use a specific voice for reading web pages
npm run start read-web "https://example.com" --voice "Microsoft David"
```

The voice name should match exactly what is shown in the `voices` command output.

## Example Usage

Here's a typical workflow:

1. Start reading a text file:
```bash
npm run start speak document.txt
```

2. Use keyboard controls while reading:
   - Press `space` to pause/resume
   - Use arrow keys or `b`/`f` to navigate
   - Press `r` to replay current sentence
   - Press `q` to quit cleanly

3. If needed, specify a voice when starting:
```bash
npm run start speak document.txt --voice "Microsoft David"
```

The interactive controls work the same way for all reading commands:
```bash
npm run start say "Hello World"           # Direct text
npm run start read-web "example.com"      # Web content
```

## How It Works

The application is built with TypeScript and consists of four main components:

1. **Speech Service** (`src/services/speechService.ts`)
   - Uses Windows PowerShell's System.Speech.Synthesis
   - Converts text to speech using native Windows text-to-speech engine
   - Handles speech synthesis and error management

2. **File Reader** (`src/services/fileReader.ts`)
   - Handles reading text files
   - Validates file extensions
   - Provides error handling for file operations

3. **Web Reader** (`src/services/webReader.ts`)
   - Fetches web page content using axios
   - Extracts readable content using cheerio
   - Cleans up and formats text for reading

4. **CLI Interface** (`src/index.ts`)
   - Built using Commander.js
   - Provides user-friendly command-line interface
   - Handles command parsing and execution

## Technical Details

- Built with TypeScript for type safety and better development experience
- Uses Commander.js for CLI argument parsing
- Employs native Windows PowerShell commands for text-to-speech
- Uses async/await for handling file operations and speech synthesis
- Includes error handling and user feedback

### Smart Pause Handling

The application includes intelligent pause timing for different types of content:

- Standard sentences: 500ms pause after each sentence
- List items (bullet points): 800ms pause after each item
- Enumerated items (numbered/alphabetical): 600ms pause after each item

This creates a more natural reading experience, especially for:
- Bullet-point lists (•, -, *)
- Numbered lists (1., 2., etc.)
- Alphabetical lists (a., b., etc.)
- Regular sentences with proper pauses at punctuation marks

For example, when reading:
```
1. First item
2. Second item
• Bullet point
a. Sub-item A
b. Sub-item B
```
The system automatically adjusts pauses between items for better comprehension.

## Development

For development, you can use the following npm scripts:

- `npm run build` - Compiles TypeScript to JavaScript
- `npm run start` - Runs the compiled application
- `npm run dev` - Runs the application directly with ts-node
- `npm test` - Runs the test suite

## Error Handling

The application includes error handling for common scenarios:

- Unsupported file types
- File reading errors
- Speech synthesis errors
- Invalid command usage

Error messages are displayed in the console with relevant details for troubleshooting.

## Future Improvements

Potential enhancements could include:

- Support for additional file formats
- Voice selection options
- Speech rate and pitch control
- Cross-platform support
- Integration with cloud-based text-to-speech services

## Troubleshooting

If you encounter issues:

1. Ensure you're running on a Windows system
2. Check if Windows Text-to-Speech is enabled
3. Verify file permissions for text files
4. Ensure PowerShell execution is allowed

## License

ISC License
