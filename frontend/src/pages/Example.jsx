// Example.jsx
// 示例页面，演示如何调用后端API

import { useEffect, useState } from "react";

function Example() {
  const [msg, setMsg] = useState("");

  useEffect(() => {
    // 调用后端示例API
    fetch("/api/example/hello")
      .then(res => res.json())
      .then(data => setMsg(data.msg));
  }, []);

  return (
    <div>
      <h2>示例页面</h2>
      <p>后端返回：{msg}</p>
    </div>
  );
}

export default Example; 