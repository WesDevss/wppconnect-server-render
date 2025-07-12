import path from 'path';
import dotenv from 'dotenv';
// Carrega .env da raiz do projeto (uma pasta acima de dist quando compilado)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });
import express from 'express';
import routes from './routes';
import config from './config';

const app = express();

app.use(express.json());
app.use('/', routes);

app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
