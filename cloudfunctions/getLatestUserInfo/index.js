// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const userCollection = db.collection('users');

/**
 * 获取最新的用户数据并返回，确保字段格式与前端期望一致 (name, avatar, userId)
 */
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    const { userId } = event;
    
    let query = {};
    
    if (userId) {
        query = { _id: userId };
    } else if (openid) {
        query = { openid: openid };
    } else {
        return { success: false, errMsg: '无法确定用户身份，缺少 openid 或 userId。' };
    }
    
    try {
        const userRes = await userCollection.where(query).limit(1).get();
        
        if (userRes.data && userRes.data.length > 0) {
            const dbRecord = userRes.data[0];
            
            // ⭐ 【关键修复】：将数据库字段映射为前端期望的字段
            const formattedUserInfo = { 
                // 必需字段，用于前端判断是否登录和显示
                name: dbRecord.nickName || '', 
                avatar: dbRecord.avatarUrl || '',
                
                // 关键数据，用于更新
                userId: dbRecord._id, // 将 _id 映射为 userId
                userNum: dbRecord.userNum || null,
                phone: dbRecord.phone || null,
                
                // VIP 和积分信息
                vipLevel: dbRecord.vipLevel || 1, 
                vipType: dbRecord.vipType || '普通会员',
                vipScore: dbRecord.vipScore || 0,
                vipExp: dbRecord.vipExp || 0,
                
                // 其他字段
                board: dbRecord.board || null,
                boardUrl: dbRecord.boardUrl || null,
            };

            return {
                success: true,
                userInfo: formattedUserInfo, // 返回映射后的对象
                errMsg: '成功获取最新的用户信息'
            };
        } else {
            return { success: false, errMsg: '未在数据库中找到用户记录。' };
        }

    } catch (e) {
        console.error('获取最新用户信息云函数执行失败:', e);
        return {
            success: false,
            errMsg: `数据库查询失败: ${e.message}`
        };
    }
};