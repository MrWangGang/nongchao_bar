const cloud = require('wx-server-sdk')
const jwt = require('jsonwebtoken') 

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) 

const db = cloud.database()
const userCollection = db.collection('users') 
// 引用新增的积分和经验历史记录表
const scoreHistoryCollection = db.collection('score_his')
const expHistoryCollection = db.collection('exp_his')

const JWT_SECRET = '1234567890qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM,./' 
const JWT_EXPIRES_IN = '7d' 

/**
 * 内部函数：生成一个唯一的9位随机数字符串作为 userNum
 */
async function generateUniqueUserNum() {
    let userNum;
    let isUnique = false;
    
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
 * 插入历史记录的通用函数
 * @param {string} userId - 用户记录的 _id
 * @param {string} action - 行为描述 (e.g., "注册会员")
 * @param {number} value - 变化的值 (积分或经验)
 * @param {object} collection - 要插入的数据库集合 (scoreHistoryCollection 或 expHistoryCollection)
 */
async function insertHistoryRecord(userId, action, value, collection) {
    if (value !== 0) {
        try {
            await collection.add({
                data: {
                    userId: userId,
                    action: action,
                    value: value,
                    createdAt: db.serverDate(),
                }
            });
        } catch (error) {
            console.error(`插入历史记录失败 (${action}, ${value}, ${collection.name}):`, error);
        }
    }
}

/**
 * 云函数入口函数：处理微信授权登录和用户信息更新
 */
exports.main = async (event, context) => {
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID 
    const unionid = wxContext.UNIONID 
    const { nickName, avatarUrl } = event 
    
    const finalUnionid = unionid || null;
    
    if (!openid) {
        return { success: false, message: '无法获取 OpenID，授权失败。' }
    }
    
    let userToReturn = null;
    const INITIAL_SCORE = 10;
    const INITIAL_EXP = 100;
    const REGISTER_ACTION = "注册会员";

    try {
        let userRecord = await userCollection.where({ openid }).get()
        let userId = null; 
        let userNum = null;

        if (userRecord.data.length === 0) {
            // ===================================
            // 新用户：创建记录 (并赠送积分/经验)
            // ===================================
            userNum = await generateUniqueUserNum();
            
            const res = await userCollection.add({
                data: {
                    phone: null, 
                    openid: openid,
                    unionid: finalUnionid,
                    nickName: nickName,
                    avatarUrl: avatarUrl, 
                    userNum: userNum, 
                    vipLevel: 1, 
                    vipScore: INITIAL_SCORE,     // 初始积分 10
                    vipExp: INITIAL_EXP,         // 初始经验 100
                    board: null,                 // 【已修改】灯牌 key 字段初始化为 null
                    boardUrl: null,              // 【新增】灯牌图片 URL 字段初始化为 null
                    createdAt: db.serverDate(),
                    lastLoginAt: db.serverDate(),
                }
            })
            userId = res._id; 
            
            // 插入历史记录
            await insertHistoryRecord(userId, REGISTER_ACTION, INITIAL_SCORE, scoreHistoryCollection);
            await insertHistoryRecord(userId, REGISTER_ACTION, INITIAL_EXP, expHistoryCollection);

            userToReturn = { 
                name: nickName, 
                avatar: avatarUrl, 
                phone: null, 
                userId: userId, 
                userNum: userNum,
                vipLevel: 1, 
                vipScore: INITIAL_SCORE,
                vipExp: INITIAL_EXP,
                board: null,                     // 【已修改】返回 board 字段
                boardUrl: null                   // 【新增】返回 boardUrl 字段
            };
        } else {
            // ===================================
            // 老用户：更新信息 (并检查字段缺失)
            // ===================================
            const data = userRecord.data[0];
            userId = data._id; 
            userNum = data.userNum; 
            
            const updateData = {
                nickName: nickName,
                avatarUrl: avatarUrl,
                unionid: finalUnionid || data.unionid || null, 
                lastLoginAt: db.serverDate(),
            };
            
            let finalVipScore = data.vipScore;
            let finalVipExp = data.vipExp;
            let finalBoard = data.board === undefined ? null : data.board; 
            let finalBoardUrl = data.boardUrl === undefined ? null : data.boardUrl; // 【新增】处理 boardUrl 字段

            // 检查 vipScore 是否缺失
            if (data.vipScore === undefined) {
                updateData.vipScore = INITIAL_SCORE;
                finalVipScore = INITIAL_SCORE;
                await insertHistoryRecord(userId, REGISTER_ACTION, INITIAL_SCORE, scoreHistoryCollection);
            }

            // 检查 vipExp 是否缺失
            if (data.vipExp === undefined) {
                updateData.vipExp = INITIAL_EXP;
                finalVipExp = INITIAL_EXP;
                await insertHistoryRecord(userId, REGISTER_ACTION, INITIAL_EXP, expHistoryCollection);
            }
            
            // 检查 vipLevel 是否缺失
            if (data.vipLevel === undefined) {
                updateData.vipLevel = 1;
            }
            
            // 【已修改】检查 board 字段是否缺失
            if (data.board === undefined) {
                updateData.board = null; 
            }
            
            // 【新增】检查 boardUrl 字段是否缺失
            if (data.boardUrl === undefined) {
                updateData.boardUrl = null; 
            }
            
            // 执行更新
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
                vipLevel: data.vipLevel === undefined ? 1 : data.vipLevel, 
                vipScore: finalVipScore, 
                vipExp: finalVipExp,
                board: finalBoard,                    // 【已修改】返回 board 字段
                boardUrl: finalBoardUrl               // 【新增】返回 boardUrl 字段
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