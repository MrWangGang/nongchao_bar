// 云函数入口文件
const cloud = require('wx-server-sdk');

// 使用 DYNAMIC_CURRENT_ENV 初始化，确保云函数在当前环境中运行
cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();
const _ = db.command;

/**
 * 下单云函数：将订单信息存储到 cocktails_order 表中
 * @param {object} event - 客户端调用时传入的参数
 * @param {object} context - 云函数上下文
 */
exports.main = async (event, context) => {
    
    const { 
        products,          // 商品列表
        totalAmount,       // 总金额
        totalCount,        // 总件数
        recipeName,        // 酒谱名称（如果有）
        remark,            // 订单备注
        uploadedImages,    // 上传的图片列表 (用于获取所有图片和第一张图片)
        orderStatus,       // 初始订单状态 (如 '待支付')
        userId             // 从调用者传入的 event 中获取 userId
    } = event;

    // 基础校验
    if (!products || products.length === 0 || !totalAmount || !userId) {
        return {
            success: false,
            errMsg: '订单数据缺失、商品为空或用户ID (userId) 缺失'
        };
    }

    // 关键逻辑：检查是否存在待支付订单
    try {
        const existingOrder = await db.collection('cocktails_order').where({
            userId: userId,
            orderStatus: '待支付'
        }).limit(1).get();

        if (existingOrder.data && existingOrder.data.length > 0) {
            // 找到待支付订单，阻止新的订单创建
            return {
                success: false,
                errMsg: `您已有一个待支付订单 (编号: ${existingOrder.data[0].no})，请先完成支付或取消。`
            };
        }
    } catch (e) {
        console.error('检查待支付订单失败', e);
        return {
            success: false,
            errMsg: '订单检查失败，请重试。'
        };
    }
    
    // 生成订单号 (简单示例，实际应用中应更严谨)
    const dateStr = new Date().getTime().toString();
    const randomStr = Math.random().toString(36).substr(2, 4).toUpperCase();
    const orderNo = `CO${dateStr.slice(-8)}${randomStr}`;

    const orderData = {
        no: orderNo,                      // 订单编号
        userId: userId,                   // 用户ID
        products: products,               // 商品列表
        totalCount: totalCount,           // 订单总件数
        recipeName: recipeName || '',     // 酒谱名称
        remark: remark || '',             // 备注
        image: uploadedImages && uploadedImages.length > 0 ? uploadedImages[0] : '', // 仅存第一张图片
        // *** 关键修改：恢复 images 数组字段 ***
        images: uploadedImages || [],     // 存储所有图片 URL
        orderStatus: orderStatus || '待支付', // 初始状态
        
        // payment 对象初始化
        payment: {                        
            paymentMethod: null,          // 支付方式 (初始化为 null)
            paymentTime: null,            // 支付时间 (初始化为 null)
            totalAmount: totalAmount,     // 订单总金额 (从 event 中获取)
            transactionId: null,          // 交易流水号 (初始化为 null)
        },
        
        createTime: db.serverDate(),      // 下单时间
        updateTime: db.serverDate(),
    };

    try {
        // 数据库集合名称：'cocktails_order'
        const result = await db.collection('cocktails_order').add({
            data: orderData
        });

        return {
            success: true,
            data: {
                _id: result._id,          // 返回数据库生成的 _id (即 cocktailId)
                orderNo: orderNo,
                orderStatus: orderData.orderStatus
            },
            errMsg: '订单创建成功'
        };
    } catch (e) {
        console.error('订单创建失败', e);
        return {
            success: false,
            errMsg: `订单创建失败：${e.errMsg || e}`
        };
    }
};