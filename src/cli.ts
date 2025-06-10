#!/usr/bin/env node
import { Command } from 'commander';
import { FileReader } from './services/fileReader';
import { WebReader } from './services/webReader';
import { SpeechService } from './services/speechService';
import * as readline from 'readline';

async function main(): Promise<void> {
  const program = new Command();

  program
    .version('0.1.4')
    .description('A CLI tool to read text files and websites aloud')
    .argument('<source>', 'The path to a local file or a URL to read')
    .action(async (source: string) => {
      try {
        let content = '';
        if (source.startsWith('http')) {
          console.log(`Fetching content from: ${source}`);
          content = await WebReader.read(source);
        } else {
          console.log(`Reading file from: ${source}`);
          content = await FileReader.read(source);
        }

        if (!content) {
          console.error('Could not read the content.');
          process.exit(1);
        }

        const speechService = new SpeechService();

        readline.emitKeypressEvents(process.stdin);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
        }

        console.log('\\nStarting playback...');
        console.log(`
Playback Controls:
  [space] - Pause/Resume
  [←/→]  - Previous/Next sentence
  [q]    - Quit
`);

        process.stdin.on('keypress', async (str, key) => {
          if (key.ctrl && key.name === 'c' || key.name === 'q') {
            console.log('\\nStopping playback...');
            await speechService.stop();
            process.exit(0);
          } else if (key.name === 'space') {
            if (speechService.isPaused) {
              speechService.resume();
            } else {
              speechService.pause();
            }
          } else if (key.name === 'right') {
            speechService.forward();
          } else if (key.name === 'left') {
            speechService.rewind();
          }
        });

        speechService.on('done', () => {
          console.log('\\nFinished reading.');
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.exit(0);
        });

        await speechService.speak(content);

      } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

main();
