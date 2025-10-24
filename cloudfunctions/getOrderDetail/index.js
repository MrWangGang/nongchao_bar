// getOrderDetail/index.js 的完整代码
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  // 参数名改为 orderId
  const { orderId } = event

  if (!orderId) {
    return { success: false, errMsg: '缺少订单ID参数', code: 1 }
  }

  try {
    // 使用 .doc() 方法通过 _id 查询，效率更高
    const orderRes = await db.collection('seats_order').doc(orderId).get()

    // .doc().get() 的返回结果中，data 就是一个对象，而不是数组
    if (orderRes.data) {
      return {
        success: true,
        errMsg: '查询成功',
        code: 0,
        data: orderRes.data 
      }
    } else {
      // 理论上 .doc().get() 找不到会直接抛出异常并进入 catch
      return { success: false, errMsg: '未找到该订单', code: 2, data: null }
    }
  } catch (e) {
    console.error('查询订单失败:', e);
    // 如果ID不存在，错误信息中会包含 "does not exist"
    if (e.errMsg && e.errMsg.includes('does not exist')) {
        return { success: false, errMsg: '未找到该订单', code: 2, data: null };
    }
    return { success: false, errMsg: '数据库查询失败', error: e, code: -1 }
  }
}