// 云函数入口文件 getMealOrderDetail/index.js
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
})

const db = cloud.database()
const _ = db.command

const ORDERS_COLLECTION = 'meals_order';

/**
 * 云函数入口函数：根据订单ID获取订单详情
 * @param {object} event - 只接受 dbId (_id)
 */
exports.main = async (event, context) => {
    // 【修改点 1】只接收 dbId 参数
    const { dbId } = event
    
    // 【修改点 2】只检查 dbId
    let whereCondition = {};
    if (dbId) {
        whereCondition = { _id: dbId };
    } else {
        // 【修改点 3】修改错误提示，明确只接受 _id
        return { success: false, errMsg: '缺少订单标识参数 (dbId)' };
    }

    try {
        const orderRes = await db.collection(ORDERS_COLLECTION)
            .where(whereCondition)
            .limit(1)
            .get();

        if (orderRes.data.length === 0) {
            return { success: false, errMsg: '未找到该订单' };
        }

        const orderDetail = orderRes.data[0];

        // 格式化时间，方便前端展示
        if (orderDetail.createTime) {
            // 使用 toLocaleString 格式化为本地时间，假定北京时间 (CST/UTC+8)
            orderDetail.formattedCreateTime = new Date(orderDetail.createTime).toLocaleString('zh-CN', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit', second: '2-digit', 
                hour12: false, timeZone: 'Asia/Shanghai' 
            }).replace(/\//g, '/').replace(',', ''); // 格式化为 YYYY/MM/DD HH:MM:SS 
        }
        
        // 提取需要展示的商品总数和总价
        const totalCount = orderDetail.totalCount || 0;
        const totalAmount = orderDetail.payment ? orderDetail.payment.totalAmount : 0;
        const productsToShow = orderDetail.products.slice(0, 3); // 只显示前3个商品
        const remainingProductsCount = orderDetail.products.length - productsToShow.length;

        return { 
            success: true, 
            data: {
                ...orderDetail,
                productsToShow: productsToShow,
                remainingProductsCount: remainingProductsCount,
                totalCount: totalCount,
                totalAmount: totalAmount
            }
        };

    } catch (e) {
        console.error('获取订单详情失败', e);
        return { 
            success: false, 
            errMsg: `查询失败: ${e.message || '数据库操作错误'}` 
        };
    }
};