const cloud = require('wx-server-sdk')

// 初始化云函数
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 引用云数据库
const db = cloud.database()
const _ = db.command // 引入 db.command 用于更新嵌套字段

// --- 集合定义（集合引用对象）---
const orderCollection = db.collection('seats_order') 
const bookCollection = db.collection('seats_book') 
const userCollection = db.collection('users') 

// --- 集合名称常量（修复后的关键）---
const scoreHistoryCollectionName = 'score_his';
const expHistoryCollectionName = 'exp_his';

// --- 积分/经验常量 ---
const ADD_SCORE = 10;
const ADD_EXP = 50;
const ACTION_NAME = "预定订单";

// --- VIP 等级所需总经验值 (必须与业务逻辑一致) ---
const VIP_LEVELS = [
    { level: 1, requiredExp: 0 },          
    { level: 2, requiredExp: 300 },      
    { level: 3, requiredExp: 1300 }, 
    { level: 4, requiredExp: 2800 }, 
    { level: 5, requiredExp: 5800 }, 
];

/**
 * 根据用户的总经验值计算当前应有的 VIP 等级
 */
function calculateVipLevel(totalExp) {
    let currentLevel = 1;
    for (let i = VIP_LEVELS.length - 1; i >= 0; i--) {
        if (totalExp >= VIP_LEVELS[i].requiredExp) {
            currentLevel = VIP_LEVELS[i].level;
            break; 
        }
    }
    return currentLevel;
}

/**
 * 插入历史记录的通用函数 (在事务中使用)
 * @param {string} collectionName - 集合名称的字符串
 */
async function insertHistoryRecord(tx, userId, action, value, collectionName) {
    if (value !== 0) {
        // 【修复点】：tx.collection() 需要传入集合名称字符串
        await tx.collection(collectionName).add({ 
            data: {
                userId: userId,
                action: action,
                value: value,
                createdAt: db.serverDate(),
            }
        });
    }
}


/**
 * 订单更新云函数
 */
exports.main = async (event, context) => {
  const {
    orderId, // 订单记录的 _id
    updateData
  } = event

  console.log('--- updateOrder 云函数开始 ---');

  if (!orderId || !updateData) {
    return { success: false, errMsg: '缺少订单ID(_id)或更新数据' }
  }

  const currentTime = new Date(); 
  
  // 仅在支付成功时使用事务，否则使用非事务方式 (保持订单取消逻辑的简单性)
  if (updateData.orderStatus === '已支付') {
      
    // ========================================================
    // ⭐ 【核心事务逻辑：支付成功 + 积分/经验更新】
    // ========================================================
    const transaction = await db.startTransaction();

    try {
        // 1. 获取原订单记录 (事务内)
        const orderRes = await transaction.collection('seats_order').doc(orderId).get();
        const orderRecord = orderRes.data;

        if (!orderRecord) {
            await transaction.rollback();
            return { success: false, errMsg: '未找到订单记录，事务回滚' };
        }
        
        const userId = orderRecord.userId;

        // 2. 组装支付信息 (逻辑保持不变)
        const totalAmount = orderRecord.payment?.totalAmount || orderRecord.comboInfo?.price || 0;
        const paidAmount = updateData['payment.paidAmount'] || totalAmount; 

        const newPaymentData = {
            totalAmount: totalAmount,
            paidAmount: paidAmount,
            paymentMethod: '线上支付',
            paymentTime: currentTime, 
            transactionId: `TXID_${Date.now()}_${Math.floor(Math.random() * 9999)}`,
        };
        
        let finalOrderUpdateData = {
            orderStatus: '已支付',
            payment: newPaymentData,
            updateTime: currentTime,
        };
        
        // 3. 更新 seats_order 集合中的订单状态 (事务内)
        const updateOrderResult = await transaction.collection('seats_order').doc(orderId).update({
            data: finalOrderUpdateData
        });

        if (updateOrderResult.stats.updated !== 1) {
            await transaction.rollback();
            return { success: false, errMsg: '订单状态更新失败，事务回滚' };
        }
        
        console.log('订单状态更新成功，开始处理积分/经验...');


        // 4. 获取用户当前数据 (事务内)
        const userSnapshot = await transaction.collection('users').doc(userId).get();
        if (!userSnapshot.data) {
            await transaction.rollback();
            return { success: false, errMsg: '未找到匹配的用户记录，事务回滚' };
        }
        const userData = userSnapshot.data;
        
        const currentExp = userData.vipExp || 0;
        const newExp = currentExp + ADD_EXP;
        const newVipLevel = calculateVipLevel(newExp);
        
        // 5. 更新 users 集合 (累加积分/经验，更新等级) (事务内)
        await transaction.collection('users').doc(userId).update({
            data: {
                vipExp: _.inc(ADD_EXP),     
                vipScore: _.inc(ADD_SCORE), 
                vipLevel: newVipLevel,      
            }
        });
        
        // 6. 插入历史记录 (积分和经验) (事务内)
        // 【修复调用】：传入集合名称字符串
        await insertHistoryRecord(transaction, userId, ACTION_NAME, ADD_SCORE, scoreHistoryCollectionName);
        await insertHistoryRecord(transaction, userId, ACTION_NAME, ADD_EXP, expHistoryCollectionName);
        
        // 7. 提交事务
        await transaction.commit();
        
        console.log(`用户 ${userId} 积分/经验更新成功，等级: ${newVipLevel}`);

        return {
            success: true,
            errMsg: '支付成功，订单更新，积分/经验已发放并更新等级。'
        }

    } catch (e) {
        console.error(`支付成功事务失败:`, e);
        try {
            await transaction.rollback();
        } catch(rollbackErr) {
            console.error('事务回滚失败:', rollbackErr);
        }
        return {
            success: false,
            errMsg: `支付更新事务处理失败: ${e.message}`
        };
    }

  } 
  
  // ========================================================
  // ⭐ 【非事务逻辑：处理其他状态更新，如订单取消】
  // ========================================================
  else {
    
    // 默认更新数据包：包含客户端传入的所有内容，并添加 updateTime
    let finalUpdateData = {
        ...updateData,
        updateTime: currentTime,
    };
    
    try {
        // 1. 更新 seats_order 集合中的订单状态 (非事务)
        const updateOrderResult = await orderCollection.doc(orderId).update({
          data: finalUpdateData
        });

        if (updateOrderResult.stats.updated !== 1) {
          return {
            success: false,
            errMsg: '未找到匹配的订单记录(_id不正确)或数据没有变化'
          }
        }

        // 2. 如果是取消订单，执行同步更新 seats_book 逻辑
        if (finalUpdateData.orderStatus === '订单取消') {
          const orderRecordRes = await orderCollection.doc(orderId).get();
          if (!orderRecordRes.data) {
            return { success: true, errMsg: '订单状态已取消，但座位锁定状态更新失败' };
          }
          
          const { userId, seatInfo } = orderRecordRes.data;
          const seatId = seatInfo.id;

          // 2.2. 查询 seats_book 中对应的锁定记录并更新为 '失效'
          await bookCollection.where({
            seatId: seatId,
            userId: userId,
            status: '锁定' 
          }).update({
            data: {
              status: '失效',
              updateTime: currentTime 
            }
          })
        }

        // 3. 返回最终成功结果
        return {
          success: true,
          errMsg: '订单更新与同步操作成功'
        }

      } catch (e) {
        return {
          success: false,
          errMsg: `数据库操作失败: ${e.message}`
        }
      }
  }
}