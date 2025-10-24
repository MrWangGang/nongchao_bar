// 云函数入口文件 getUserMealOrders/index.js
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

const ORDERS_COLLECTION = 'meals_order';

/**
 * 云函数入口函数：根据用户ID获取全部订单列表 (无分页限制)
 * @param {object} event - 只接受 userId 参数
 * @param {object} context
 */
exports.main = async (event, context) => {
    // 1. 获取当前用户的 openid（如果需要基于 openid 查询）
    // const wxContext = cloud.getWXContext()
    // const openId = wxContext.OPENID

    // 【修改点 1】只接收 userId 参数，移除分页参数
    const { userId } = event

    // 【修改点 2】只检查 userId
    let whereCondition = {};
    if (userId) {
        whereCondition = { userId: userId }; // 假设订单集合中的用户标识字段是 'userId'
    } else {
        // 【修改点 3】修改错误提示
        return { success: false, errMsg: '缺少用户标识参数 (userId)' };
    }

    // 默认按照创建时间倒序排列 (最新的订单在前)
    const orderBy = 'createTime';
    const orderDirection = 'desc';

    try {
        // 【修改点 4】移除 count() 查询
        // 【修改点 5】移除 skip() 和 limit()，直接获取全部数据 (注意：如果数据量过大，这可能会导致超时或内存问题，建议在数据库中设置合理的索引)
        const orderRes = await db.collection(ORDERS_COLLECTION)
            .where(whereCondition)
            .orderBy(orderBy, orderDirection)
            .get();

        const ordersList = orderRes.data;
        const total = ordersList.length; // 此时 total 就是获取到的订单总数

        // 3. 遍历订单列表，进行必要的格式化和字段提取
        const formattedOrders = ordersList.map(orderDetail => {
            // 格式化时间，方便前端展示
            if (orderDetail.createTime) {
                // 使用 toLocaleString 格式化为本地时间，假定北京时间 (CST/UTC+8)
                orderDetail.formattedCreateTime = new Date(orderDetail.createTime).toLocaleString('zh-CN', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit',
                    hour12: false, timeZone: 'Asia/Shanghai'
                }).replace(/\//g, '/').replace(',', ' '); // 格式化为 YYYY/MM/DD HH:MM:SS
            }
            
            // 提取需要展示的商品总数和总价
            const totalCount = orderDetail.totalCount || 0;
            const totalAmount = orderDetail.payment ? orderDetail.payment.totalAmount : 0;
            const productsToShow = orderDetail.products ? orderDetail.products.slice(0, 3) : []; // 只显示前3个商品
            const remainingProductsCount = orderDetail.products ? orderDetail.products.length - productsToShow.length : 0;

            // 返回精简且格式化后的订单信息 (或直接返回 orderDetail，取决于前端需求)
            return {
                ...orderDetail, // 包含所有原始信息
                productsToShow: productsToShow,
                remainingProductsCount: remainingProductsCount,
                totalCount: totalCount,
                totalAmount: totalAmount,
            };
        });

        return {
            success: true,
            data: formattedOrders,
            total: total,
            // 移除 pageSize 和 pageNum
        };

    } catch (e) {
        console.error('获取用户订单列表失败', e);
        return {
            success: false,
            errMsg: `查询失败: ${e.message || '数据库操作错误'}`
        };
    }
};