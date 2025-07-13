import express, { Request, Response } from 'express';

const app = express();
const port = 3001;

app.use(express.json());

// 示例接口 /report
app.post('/report', (req: Request, res: Response) => {
  // 这里只返回一个示例文本
  res.json({ report: 'This is a sample report.' });
});

app.listen(port, () => {
  console.log(`Backend server is running at http://localhost:${port}`);
}); 