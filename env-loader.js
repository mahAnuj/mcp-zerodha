import dotenv from 'dotenv';

// Load environment variables first thing
const result = dotenv.config();
if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

console.log('Environment variables loaded successfully'); 