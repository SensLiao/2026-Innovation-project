// backend/index.js
// 主入口，注册路由

const express = require('express');
const app = express();
const port = 3001;

app.use(express.json()); // 支持 JSON 请求体

// 示例路由
app.get('/api/example/hello', (req, res) => {
  // 示例接口，返回 hello world
  res.json({ msg: 'Hello, world!' });
});

// 预留SQL API
app.get('/api/sql/query', (req, res) => {
  // TODO: 实现SQL查询逻辑
  res.json({ msg: 'SQL API placeholder' });
});

// 预留LLM API
app.post('/api/llm/chat', (req, res) => {
  // TODO: 实现LLM调用逻辑
  res.json({ msg: 'LLM API placeholder' });
});

// 启动服务
app.listen(port, () => {
  console.log(`Backend listening at http://localhost:${port}`);
}); 