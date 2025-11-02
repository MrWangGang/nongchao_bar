// 云函数入口文件
const cloud = require('wx-server-sdk');

// 使用 DYNAMIC_CURRENT_ENV 初始化，确保云函数在当前环境中运行
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();

/**
 * 获取单个订单详情云函数
 * @param {object} event - 客户端调用时传入的参数
 * @param {object} event.orderId - 要查询的订单的数据库 ID (_id)
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
    // const wxContext = cloud.getWXContext(); // 暂时不需要获取用户上下文，除非需要权限验证
    const { orderId } = event;

    // 基础校验
    if (!orderId) {
        return {
            success: false,
            errMsg: '缺少订单 ID'
        };
    }

    try {
        // 关键查询：使用传入的 orderId 匹配数据库的 _id 字段
        const result = await db.collection('cocktails_order').where({
            _id: orderId 
        }).limit(1).get();

        if (result.data && result.data.length > 0) {
            // 查询成功
            return {
                success: true,
                data: result.data[0], // 返回第一条匹配的订单记录
                errMsg: '订单详情获取成功'
            };
        } else {
            // 未找到订单
            return {
                success: false,
                errMsg: '未找到订单详情'
            };
        }
    } catch (e) {
        console.error('获取订单详情失败', e);
        return {
            success: false,
            errMsg: `数据库查询失败：${e.errMsg || e}`
        };
    }
};