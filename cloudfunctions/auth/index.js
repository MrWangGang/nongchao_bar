// cloud/login/index.js
const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken') 

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) 

const db = cloud.database()
const userCollection = db.collection('users') 

const JWT_SECRET = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM,./' 
const JWT_EXPIRES_IN = '7d' 

/**
 * 内部函数：生成一个唯一的9位随机数字符串作为 userNum
 */
async function generateUniqueUserNum() {
    let userNum;
    let isUnique = false;
    
    // 循环直到生成的 userNum 在数据库中不存在
    while (!isUnique) {
        userNum = Math.floor(100000000 + Math.random() * 900000000).toString();
        
        const result = await userCollection.where({ userNum: userNum }).count();
        
        if (result.total === 0) {
            isUnique = true;
        }
    }
    return userNum;
}

/**
 * 云函数入口函数：处理微信授权登录和用户信息更新
 */
exports.main = async (event, context) => {
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID 
    const unionid = wxContext.UNIONID // <-- 获取 unionid
    const { nickName, avatarUrl } = event 
    
    // <--- 核心修正：如果 unionid 为空字符串，将其视为 null --->
    const finalUnionid = unionid || null;
    
    if (!openid) {
        return { success: false, message: '无法获取 OpenID，授权失败。' }
    }
    
    let userToReturn = null; // 初始化为 null，等待赋值

    try {
        let userRecord = await userCollection.where({ openid }).get()
        let userId = null; 
        let userNum = null;

        if (userRecord.data.length === 0) {
            // 新用户：创建记录
            userNum = await generateUniqueUserNum();
            
            const res = await userCollection.add({
                data: {
                    phone: null, 
                    openid: openid,
                    unionid: finalUnionid,
                    nickName: nickName,
                    avatarUrl: avatarUrl, 
                    userNum: userNum, 
                    // 【移除 isVip】
                    vipLevel: 0, // 【保留并设置初始值】
                    vipScore: 0, // 【保留并设置初始值】
                    createdAt: db.serverDate(),
                    lastLoginAt: db.serverDate(),
                }
            })
            userId = res._id; 
            userToReturn = { 
                name: nickName, 
                avatar: avatarUrl, 
                phone: null, 
                userId: userId, 
                userNum: userNum,
                // 【移除 isVip】
                vipLevel: 0, 
                vipScore: 0
            };
        } else {
            // 老用户：更新信息和登录时间
            const data = userRecord.data[0];
            userId = data._id; 
            userNum = data.userNum; 
            
            // 构造更新数据对象
            const updateData = {
                nickName: nickName,
                avatarUrl: avatarUrl,
                unionid: finalUnionid || data.unionid || null, 
                lastLoginAt: db.serverDate(),
            };
            
            // 确保老用户记录中存在新增的 vipLevel 和 vipScore 字段
            if (data.vipLevel === undefined) {
                updateData.vipLevel = 0;
            }
            if (data.vipScore === undefined) {
                updateData.vipScore = 0;
            }
            
            await userCollection.where({ openid }).update({
                data: updateData
            })
            
            // 构造返回给小程序端的用户信息
            userToReturn = { 
                name: nickName, 
                avatar: avatarUrl, 
                phone: data.phone || null, 
                userId: userId, 
                userNum: userNum,
                // 【移除 isVip】
                vipLevel: data.vipLevel === undefined ? 0 : data.vipLevel, 
                vipScore: data.vipScore === undefined ? 0 : data.vipScore 
            };
        }
        
        // 4. 签发 JWT Token 
        const payload = { 
            userId: userId, 
            userNum: userNum, 
            openid: openid 
        };
        
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

        // 5. 返回 Token 和用户信息
        return {
            success: true,
            message: '登录成功！',
            token: token,
            userId: userId,
            userInfo: userToReturn 
        }

    } catch (e) {
        console.error('严重错误：数据库操作或 JWT 签发失败。', e)
        return { success: false, message: '服务器处理失败：数据库错误。' }
    }
}