<<<<<<< HEAD
import express, { Request, Response } from 'express';
=======
import express, { NextFunction, Request, Response } from 'express';
>>>>>>> 7a247da (fix for error handler)
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req: Request, res: Response, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

app.use('/', routes);

<<<<<<< HEAD
app.use((err: Error, req: Request, res: Response) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});
=======
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  });
>>>>>>> 7a247da (fix for error handler)

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
