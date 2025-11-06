// 云函数入口文件：getScoreHistory/index.js
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const scoreHistoryCollection = db.collection('score_his');

/**
 * 获取积分历史记录列表
 * @param {object} event 
 * @param {number} [event.page=1] - 页码
 * @param {number} [event.pageSize=10] - 每页数量
 * @returns {object} - 包含 success 状态和 list 数组
 */
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const userId = event.userId; // 接收用户ID，或从缓存中获取的 _id
    
    // 默认值
    const page = event.page || 1;
    const pageSize = event.pageSize || 10;
    const skip = (page - 1) * pageSize;
    
    if (!userId) {
        // 通常在登录后，前端应能获取到 userId
        return { success: false, errMsg: '缺少用户ID，无法查询历史记录。' };
    }

    try {
        const result = await scoreHistoryCollection.aggregate()
            .match({
                userId: userId
            })
            .sort({
                createdAt: -1 // 按创建时间倒序
            })
            .skip(skip)
            .limit(pageSize)
            .end();

        // 同时获取总数，用于前端分页判断
        const countRes = await scoreHistoryCollection.where({ userId: userId }).count();
        const total = countRes.total;

        // 格式化数据以匹配您的设计（例如：日期格式化）
        const formattedList = result.list.map(item => {
            // 转换为易读的日期时间格式 (例如: YYYY-MM-DD HH:mm)
            const date = new Date(item.createdAt);
            const timeDisplay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            return {
                action: item.action,    // 行为描述 (e.g., "日常签到")
                value: item.value,      // 积分变化值 (e.g., +10)
                createdAt: timeDisplay, // 创建时间
            };
        });

        return {
            success: true,
            list: formattedList,
            total: total,
            page: page,
            pageSize: pageSize,
        };

    } catch (e) {
        console.error('获取积分历史记录失败:', e);
        return { success: false, errMsg: `数据库查询失败: ${e.message}` };
    }
};