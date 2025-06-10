#!/usr/bin/env node
import { SpeechService } from './services/speechService';
import { WebReader } from './services/webReader';
import { PlayerInterface } from './services/playerInterface';

const url = process.argv[2];

if (!url) {
  console.log('Usage: node cli.js <url>');
  console.log('Example: node cli.js https://example.com\n');
  console.log('Controls:');
  console.log('  [space] - Pause/Resume');
  console.log('  [←/→]  - Previous/Next sentence');
  console.log('  [q]    - Quit');
  process.exit(1);
}

const speechService = new SpeechService();
const webReader = new WebReader();
const player = new PlayerInterface(speechService);

console.log('Fetching content from:', url);

async function main() {
  try {
    const content = await webReader.readWebPage(url);
    console.log('\nStarting playback...');

    await Promise.all([
      speechService.speak(content),
      player.startInteractiveMode()
    ]);
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
