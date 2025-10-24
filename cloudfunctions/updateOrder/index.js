// cloud/functions/updateOrder/index.js
const cloud = require('wx-server-sdk')

// 初始化云函数
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 引用云数据库
const db = cloud.database()
const _ = db.command // 引入 db.command 用于更新嵌套字段
// 订单集合
const orderCollection = db.collection('seats_order') 
// 预定座位锁定集合
const bookCollection = db.collection('seats_book') 

/**
 * 订单更新云函数
 * @param {object} event 包含 orderId (订单的 _id) 和 updateData
 * @returns {object} 包含 success 状态和信息
 */
exports.main = async (event, context) => {
  const {
    orderId, // 订单记录的 _id
    updateData
  } = event

  console.log('--- updateOrder 云函数开始 ---');
  console.log(`接收到订单ID (_id): ${orderId}`);
  console.log('接收到更新数据 (updateData):', updateData);

  if (!orderId || !updateData) {
    console.error('错误: 缺少订单ID或更新数据');
    return {
      success: false,
      errMsg: '缺少订单ID(_id)或更新数据'
    }
  }

  // 统一的当前时间戳，用于所有需要记录操作时间的字段
  const currentTime = new Date(); 

  // 默认更新数据包：包含客户端传入的所有内容，并添加 updateTime
  let finalUpdateData = {
    ...updateData,
    updateTime: currentTime,
  };

  try {
    
    // --- 1. 处理支付成功逻辑 (如果 orderStatus 被设为 '已支付') ---
    if (updateData.orderStatus === '已支付') {
        console.log('检测到支付状态更新，生成支付信息...');
        
        // ⭐ 【解决冲突步骤 1】：清除客户端传入的 payment 点操作字段
        for (const key in finalUpdateData) {
            if (key.startsWith('payment.')) {
                delete finalUpdateData[key];
            }
        }
        
        // 1.1. 获取原订单记录 (需要获取 totalAmount)
        const orderRes = await orderCollection.doc(orderId).get();
        const orderRecord = orderRes.data;

        if (!orderRecord) {
            // 订单不存在，但状态已改，理论上不应该发生在这里，但作为安全检查
            return { success: false, errMsg: '未找到订单记录，无法完成支付更新' };
        }
        
        // 1.2. 组装支付信息
        // 从原记录或传入数据中获取总金额
        const totalAmount = orderRecord.payment?.totalAmount || orderRecord.comboInfo?.price || 0;
        // 从传入数据中获取 paidAmount，否则使用 totalAmount
        const paidAmount = finalUpdateData['payment.paidAmount'] || totalAmount; 

        const newPaymentData = {
            totalAmount: totalAmount,
            paidAmount: paidAmount,
            paymentMethod: '线上支付',
            paymentTime: currentTime, // Date 类型
            transactionId: `TXID_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        };

        // ⭐ 【解决冲突步骤 2】：使用完整的 payment 对象覆盖
        // 注意：这里使用 db.command.set() 是为了确保我们是设置/覆盖整个 payment 对象，而不是合并。
        // 但为了保持简洁，我们直接在 finalUpdateData 中设置 payment 字段。
        finalUpdateData.payment = newPaymentData;
    }
    
    // --- 2. 更新 seats_order 集合中的订单状态 ---
    const updateOrderResult = await orderCollection.doc(orderId).update({
      data: finalUpdateData
    });

    console.log(`seats_order 更新结果 stats:`, updateOrderResult.stats);

    if (updateOrderResult.stats.updated !== 1) {
      console.error('错误: 未找到匹配的订单记录或更新失败');
      return {
        success: false,
        errMsg: '未找到匹配的订单记录(_id不正确)或数据没有变化'
      }
    }

    // --- 3. 如果是取消订单，执行同步更新 seats_book 逻辑 ---
    if (finalUpdateData.orderStatus === '订单取消') {
      console.log('开始执行取消订单后 seats_book 的同步更新...');
      // 这里的逻辑没有使用事务，但您原始代码如此，故保留结构。

      // 3.1. 获取原订单记录 (如果之前没获取到，现在再查一次)
      const orderRecord = await orderCollection.doc(orderId).get();
      if (!orderRecord.data) {
        console.error('错误: 取消订单时，未能查找到原订单记录');
        return { success: true, errMsg: '订单状态已取消，但座位锁定状态更新失败' };
      }
      
      const { userId, seatInfo } = orderRecord.data;
      const seatId = seatInfo.id;
      
      console.log(`预定信息: userId=${userId}, seatId=${seatId}`);

      // 3.2. 查询 seats_book 中对应的锁定记录并更新为 '失效'
      const updateBookResult = await bookCollection.where({
        seatId: seatId,
        userId: userId,
        status: '锁定' // 确保只更新当前处于锁定状态的记录
      }).update({
        data: {
          status: '失效',
          updateTime: currentTime 
        }
      })

      console.log(`seats_book 释放座位锁定结果 stats:`, updateBookResult.stats);

      if (updateBookResult.stats.updated >= 1) {
        console.log(`成功释放 seats_book 中 ${updateBookResult.stats.updated} 条锁定记录。`);
      } else {
        console.log('注意: seats_book 中没有找到或未更新锁定状态的记录。');
      }
    }

    // --- 4. 返回最终成功结果 ---
    console.log('--- updateOrder 云函数执行成功 ---');
    return {
      success: true,
      errMsg: '订单更新与同步操作成功'
    }

  } catch (e) {
    console.error(`更新订单 ${orderId} 失败:`, e);
    return {
      success: false,
      errMsg: `数据库操作失败: ${e.message}`
    }
  }
}