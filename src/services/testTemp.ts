import * as fs from 'fs/promises';
import * as path from 'path';

async function testTempDir() {
  const tempDir = path.join(process.cwd(), 'temp_speech');
  console.log('Testing temp directory functionality...');
  
  try {
    // Check if directory exists
    try {
      await fs.access(tempDir);
      console.log('✓ Temp directory exists');
    } catch (e) {
      console.log('× Temp directory does not exist');
      console.log('Creating temp directory...');
      await fs.mkdir(tempDir, { recursive: true });
      console.log('✓ Temp directory created');
    }

    // Test write permissions
    const testFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(testFile, 'Test content');
    console.log('✓ Successfully wrote test file');
    
    // Test read permissions
    const content = await fs.readFile(testFile, 'utf8');
    console.log('✓ Successfully read test file');
    
    // Test file listing
    const files = await fs.readdir(tempDir);
    console.log(`✓ Can list directory (${files.length} files found)`);
    
    // Clean up test file
    await fs.unlink(testFile);
    console.log('✓ Successfully deleted test file');
    
    console.log('\nAll tests passed! Temp directory is working correctly.');
    
  } catch (error) {
    console.error('\nError during temp directory test:', error);
    console.error('\nPlease ensure:');
    console.error('1. The application has write permissions to', tempDir);
    console.error('2. The directory path is valid');
    console.error('3. There is enough disk space');
    process.exit(1);
  }
}

testTempDir().catch(console.error);
