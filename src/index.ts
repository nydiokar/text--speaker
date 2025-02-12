#!/usr/bin/env node
import { Command } from 'commander';
import { FileReader } from './services/fileReader';
import { SpeechService, Voice } from './services/speechService';
import { WebReader } from './services/webReader';
import { PlayerInterface } from './services/playerInterface';
import { MenuInterface } from './services/menuInterface';

const program = new Command();
const fileReader = new FileReader();
const speechService = new SpeechService();
const webReader = new WebReader();

// Check if any arguments were provided
if (process.argv.length === 2) {
  // No arguments - start interactive menu
  const menu = new MenuInterface();
  menu.start().catch(error => {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
} else {
  // Arguments provided - use command line interface

program
  .name('speaker-ai')
  .description('A CLI tool to read text files aloud')
  .version('1.0.0');

program
  .command('voices')
  .description('List available voices')
  .action(async () => {
    try {
      const voices = await speechService.getVoices();
      voices.forEach(voice => {
        console.log(`- Name: ${voice.name}`);
        console.log(`  Culture: ${voice.culture}`);
        console.log(`  Gender: ${voice.gender}\n`);
      });
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('speak')
  .description('Read a text file aloud')
  .argument('<file>', 'Path to the text file')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async (file: string, options: { voice?: string }) => {
    try {
      const content = await fileReader.readTextFile(file);
      const player = new PlayerInterface(speechService);
      console.log('Starting playback...');
      await Promise.all([
        speechService.speak(content, options.voice),
        player.startInteractiveMode()
      ]);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('say')
  .description('Read provided text aloud')
  .argument('<text>', 'Text to read')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async (text: string, options: { voice?: string }) => {
    try {
      const player = new PlayerInterface(speechService);
      console.log('Starting playback...');
      await Promise.all([
        speechService.speak(text, options.voice),
        player.startInteractiveMode()
      ]);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('pause')
  .description('Pause speech synthesis')
  .action(async () => {
    try {
      await speechService.pause();
      console.log('Speech synthesis paused');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume speech synthesis')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async () => {
    try {
      await speechService.resume();
      console.log('Speech synthesis resumed');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('rewind')
  .description('Rewind speech by specified number of sentences')
  .argument('[sentences]', 'Number of sentences to rewind', '1')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async (sentences: string) => {
    try {
      await speechService.rewind(parseInt(sentences, 10));
      console.log(`Rewound ${sentences} sentence(s)`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('forward')
  .description('Forward speech by specified number of sentences')
  .argument('[sentences]', 'Number of sentences to forward', '1')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async (sentences: string) => {
    try {
      await speechService.forward(parseInt(sentences, 10));
      console.log(`Forwarded ${sentences} sentence(s)`);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('replay')
  .description('Replay current sentence')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async () => {
    try {
      await speechService.replay();
      console.log('Replaying current sentence');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('stop')
  .description('Stop speech synthesis')
  .action(async () => {
    try {
      await speechService.stop();
      console.log('Speech synthesis stopped');
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('read-web')
  .description('Read content from a webpage')
  .argument('<url>', 'URL of the webpage to read')
  .option('-v, --voice <name>', 'Voice to use (get names from "voices" command)')
  .action(async (url: string, options: { voice?: string }) => {
    try {
      console.log('Fetching webpage content...');
      const content = await webReader.readWebPage(url);
      console.log('Starting speech synthesis...');
      const player = new PlayerInterface(speechService);
      console.log('Starting playback...');
      await Promise.all([
        speechService.speak(content, options.voice),
        player.startInteractiveMode()
      ]);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

  program.parse();
}
