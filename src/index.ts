import dotenv from 'dotenv';
import { buildApp } from './app';

dotenv.config();

const app = buildApp();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const start = async () => {
  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
