import express from "express";
import bcrypt from "bcrypt";
import { requireAuth } from "../auth/requireAuth.js";
import { signAccessToken, setLoginCookie, clearLoginCookie } from "../auth/jwt.js";
import { sql } from "../config/db.js";


async function findUserByEmail(email) {
    const user = await sql`
        SELECT * FROM users WHERE Email = ${email}
    `;
    return user[0];
}

async function findUserByID(id) {
    const user = await sql`
        SELECT uid, name, email, phone, profilephoto, createdat, yearofexperience, education, languages
        FROM users WHERE UID = ${id}
    `;
    return user[0];
}

export default function buildAuthRouter() {
    const router = express.Router();

    //登录
    router.post('/login', async (req, res) => {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        //使用sql查询
        const user = await findUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid Email' });
        }

        //后续更换为bcrypt密码验证
        const ok = btoa(password) === user.passwordhash; // TODO: remove this line after testing
        if (!ok) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const token = await signAccessToken(user);
        // 判断当前运行环境是否是生产环境(production)
        // 生产环境下，cookie的secure属性应设为true， 切换一些配置如是否启用更严格的coookie安全策略
        const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
        setLoginCookie(res, token, { secure: isProd });
        
        res.json({
            ok: true,
            uid: user.uid,
            email: user.email,
            name: user.name,
        });
    });

    //当前登录用户信息
    router.get('/me', requireAuth, async (req, res) => {
        const user = await findUserByID(req.user.uid);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    });

    //登出
    router.post('/logout', (req, res) => {
        const isProd = (process.env.NODE_ENV || "").toLowerCase() === "production";
        clearLoginCookie(res, { secure: isProd });
        res.json({ ok: true });
    });

    return router;

}