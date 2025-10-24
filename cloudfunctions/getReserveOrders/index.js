// cloud/functions/getReserveOrders/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const orderCollection = db.collection('seats_order')

/**
 * 获取当前用户的预定订单列表
 * @param {object} event 包含 userId
 * @returns {object} 包含 success 状态和订单数据数组
 */
exports.main = async (event, context) => {
  const { userId } = event

  if (!userId) {
    return {
      success: false,
      errMsg: '缺少用户ID',
      data: []
    }
  }

  try {
    // 按照创建时间倒序排列，以显示最新订单在前
    const result = await orderCollection.where({
      userId: userId
    })
    .orderBy('createTime', 'desc')
    .get()

    console.log(`用户 ${userId} 订单查询结果: ${result.data.length} 条记录`);

    return {
      success: true,
      data: result.data
    }

  } catch (e) {
    console.error(`查询订单失败:`, e)
    return {
      success: false,
      errMsg: `数据库查询失败: ${e.message}`,
      data: []
    }
  }
}