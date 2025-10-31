const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

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
    const stockRecord = {
      stockId: 'STOCK-' + Date.now() + Math.floor(Math.random() * 10000).toString(), 
      userId: userId,
      
      recipeName: finalOrder.recipeName || '无名称配方',
      
      products: finalOrder.products, 
      totalAmount: finalOrder.totalPrice, 
      totalCount: finalOrder.totalCount, 
      remark: finalOrder.remark, 
      
      // seatCode: finalOrder.seatCode || '', // 【已移除】
      // storeName: finalOrder.storeName || '未知门店', // 【已移除】
      
      imageFileIds: finalOrder.imageFileIds || [], 

      likeCount: 0, 
      createdAt: db.serverDate(), 
    };

    const result = await db.collection('cocktail_stock').add({
      data: stockRecord
    });

    return {
      success: true,
      stockId: stockRecord.stockId, 
      _id: result._id, 
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