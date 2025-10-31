const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 创建配方/备货单并存储到 cocktail_stock 集合
 */
exports.main = async (event, context) => {
  const { finalOrder, userId } = event;

  if (!userId || !finalOrder || !finalOrder.products || finalOrder.products.length === 0) {
    return {
      success: false,
      errMsg: '缺少用户ID或配方数据'
    };
  }

  try {
    // 构造要存入数据库的记录
    const stockRecord = {
      // 唯一订单号（可选，但推荐生成）
      stockId: 'STOCK-' + Date.now() + Math.floor(Math.random() * 10000).toString(), 
      userId: userId,
      products: finalOrder.products, // 包含所有商品详情
      totalAmount: finalOrder.totalPrice, // 总金额
      totalCount: finalOrder.totalCount, // 总数量 (mL)
      remark: finalOrder.remark, // 备注（制作流程）
      seatCode: finalOrder.seatCode || '', // 桌号信息
      storeName: finalOrder.storeName || '未知门店',
      
      // 【新增字段】：点赞数量，默认为 0
      likeCount: 0, 

      createdAt: db.serverDate(), // 记录创建时间
      // ** 已移除 _openid 和 status 字段 **
    };

    // 存入数据库
    const result = await db.collection('cocktail_stock').add({
      data: stockRecord
    });

    return {
      success: true,
      stockId: stockRecord.stockId, // 返回自定义的 stockId
      _id: result._id, // 返回数据库生成的 _id
      errMsg: '配方创建成功'
    };

  } catch (e) {
    console.error('创建备货单失败:', e);
    return {
      success: false,
      errMsg: '数据库操作失败：' + e.message
    };
  }
};