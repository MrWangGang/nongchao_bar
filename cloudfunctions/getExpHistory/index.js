// 云函数入口文件：getExpHistory/index.js
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const expHistoryCollection = db.collection('exp_his');

/**
 * 获取经验历史记录列表
 * @param {object} event 
 * @param {number} [event.page=1] - 页码
 * @param {number} [event.pageSize=10] - 每页数量
 * @returns {object} - 包含 success 状态和 list 数组
 */
exports.main = async (event, context) => {
    const wxContext = cloud.getWXContext();
    const userId = event.userId; // 接收用户ID，或从缓存中获取的 _id
    
    const page = event.page || 1;
    const pageSize = event.pageSize || 10;
    const skip = (page - 1) * pageSize;
    
    if (!userId) {
        return { success: false, errMsg: '缺少用户ID，无法查询历史记录。' };
    }

    try {
        const result = await expHistoryCollection.aggregate()
            .match({
                userId: userId
            })
            .sort({
                createdAt: -1 // 按创建时间倒序
            })
            .skip(skip)
            .limit(pageSize)
            .end();

        const countRes = await expHistoryCollection.where({ userId: userId }).count();
        const total = countRes.total;

        // 格式化数据以匹配您的设计
        const formattedList = result.list.map(item => {
            const date = new Date(item.createdAt);
            const timeDisplay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            
            return {
                action: item.action,    // 行为描述
                value: item.value,      // 经验变化值
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
        console.error('获取经验历史记录失败:', e);
        return { success: false, errMsg: `数据库查询失败: ${e.message}` };
    }
};