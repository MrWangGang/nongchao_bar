// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();

/**
 * 获取指定用户的所有鸡尾酒订单列表
 * @param {object} event - 客户端调用时传入的参数
 * @param {string} event.userId - 要查询的用户的 ID
 * @returns {object} - 包含 success 状态和订单数据 (data) 或错误信息 (errMsg)
 */
exports.main = async (event, context) => {
    const { userId } = event;
    
    // 基础校验
    if (!userId) {
        return {
            success: false,
            errMsg: '缺少用户 ID (userId)'
        };
    }

    try {
        // 1. 查询数据库中的 cocktails_order 集合
        const result = await db.collection('cocktails_order')
            .where({
                userId: userId // 匹配传入的 userId
            })
            // 2. 按照订单创建时间降序排列 (最新的订单排在最前面)
            .orderBy('createTime', 'desc') 
            // 3. 限制返回的订单数量 (根据需要调整)
            .limit(50) 
            .get();

        // 4. 返回查询结果
        return {
            success: true,
            data: result.data,
            errMsg: '订单列表获取成功'
        };

    } catch (e) {
        console.error('获取用户订单列表失败', e);
        return {
            success: false,
            errMsg: `获取订单列表失败：${e.errMsg || e}`
        };
    }
};