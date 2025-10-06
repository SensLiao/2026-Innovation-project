// backend/auth/requireAuth.js
import { TOKEN_COOKIE_NAME, verifyAccessToken } from "./jwt.js";

// 中间件，保护需要认证的路由
// 检查请求中的 JWT cookie 是否有效，
// 如果有效，设置 req.user = { uid, email } 并调用 next()
// 否则返回 401 未授权错误
export function requireAuth(req, res, next) {
    // 从 cookie 中获取 token
    const token = req.cookies?.[TOKEN_COOKIE_NAME];
    if (!token) return res.status(401).json({ error: "no_token" });

    // 验证 token
    try {
        const payload = verifyAccessToken(token);
        // token 有效，设置 req.user，以后直接访问req.user.uid等
        req.user = { uid: Number(payload.sub), email: payload.email };
        next(); // 验证成功，继续处理请求
    } catch (e) {
        return res.status(401).json({ error: "invalid_or_expired_token" });
    }
}
