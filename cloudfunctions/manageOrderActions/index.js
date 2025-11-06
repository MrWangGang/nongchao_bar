// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();
const _ = db.command;

// --- 集合名称常量 ---
const ORDER_COLLECTION = 'cocktails_order'; // 特调订单集合
const USER_COLLECTION = 'users';
const SCORE_HISTORY_COLLECTION = 'score_his';
const EXP_HISTORY_COLLECTION = 'exp_his';

// --- 积分/经验常量 ---
const ADD_SCORE = 10;
const ADD_EXP = 50;
const HISTORY_ACTION_NAME = "特调订单"; // ⭐ 历史记录中的 Action 名称

// --- VIP 等级所需总经验值 (保持与业务逻辑一致) ---
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
 */
async function insertHistoryRecord(tx, userId, action, value, collectionName) {
    if (value !== 0) {
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
 * 模拟支付和取消订单功能集成云函数
 */
exports.main = async (event, context) => {
    const { action, orderId, transactionId, paymentMethod } = event;
    
    if (!orderId) {
        return { success: false, errMsg: '缺少订单 ID' };
    }

    // 1. 查找订单并获取当前状态、用户ID和总金额 (非事务，用于前置校验)
    let order;
    try {
        const orderRes = await db.collection(ORDER_COLLECTION).doc(orderId).get();
        order = orderRes.data;

        if (!order) {
            return { success: false, errMsg: '订单不存在' };
        }
    } catch (e) {
         return { success: false, errMsg: `订单查询失败：${e.errMsg || e}` };
    }
    
    // 获取用户ID，用于后续的用户更新
    const userId = order.userId; // 假设特调订单记录中存储了 userId


    // 2. 根据 action 分发任务
    if (action === 'pay') {
        // ==================== 支付逻辑 (使用事务) ====================
        
        if (!transactionId || !paymentMethod) {
            return { success: false, errMsg: '支付操作缺少交易 ID 或支付方式' };
        }

        if (order.orderStatus !== '待支付') {
            return { success: false, errMsg: `订单状态错误，当前状态为: ${order.orderStatus}，无法支付` };
        }

        const totalAmount = order.payment.totalAmount; 
        const transaction = await db.startTransaction();
        
        try {
            // A. 事务内：更新 cocktails_order 状态和 payment 对象
            const updateOrderResult = await transaction.collection(ORDER_COLLECTION).doc(orderId).update({
                data: {
                    orderStatus: '已支付',
                    updateTime: db.serverDate(),
                    payment: {
                        paymentMethod: paymentMethod,
                        paymentTime: db.serverDate(),
                        totalAmount: totalAmount,
                        transactionId: transactionId,
                    }
                }
            });

            if (updateOrderResult.stats.updated !== 1) {
                await transaction.rollback();
                return { success: false, errMsg: '订单状态更新失败，事务回滚' };
            }

            // B. 事务内：获取用户当前数据
            const userSnapshot = await transaction.collection(USER_COLLECTION).doc(userId).get();
            if (!userSnapshot.data) {
                await transaction.rollback();
                return { success: false, errMsg: '未找到匹配的用户记录，事务回滚' };
            }
            const userData = userSnapshot.data;
            
            const currentExp = userData.vipExp || 0;
            const newExp = currentExp + ADD_EXP;
            const newVipLevel = calculateVipLevel(newExp);
            
            // C. 事务内：更新 users 集合 (累加积分/经验，更新等级)
            await transaction.collection(USER_COLLECTION).doc(userId).update({
                data: {
                    vipExp: _.inc(ADD_EXP),     // 累加 50 经验
                    vipScore: _.inc(ADD_SCORE), // 累加 10 积分
                    vipLevel: newVipLevel,      // 更新等级
                }
            });
            
            // D. 事务内：插入历史记录 (积分和经验)
            await insertHistoryRecord(transaction, userId, HISTORY_ACTION_NAME, ADD_SCORE, SCORE_HISTORY_COLLECTION);
            await insertHistoryRecord(transaction, userId, HISTORY_ACTION_NAME, ADD_EXP, EXP_HISTORY_COLLECTION);
            
            // E. 提交事务
            await transaction.commit();
            
            return {
                success: true,
                errMsg: '支付成功，订单状态和会员积分/经验已更新',
                newVipLevel: newVipLevel // 额外返回新等级，便于前端处理
            };

        } catch (e) {
            await transaction.rollback();
            console.error(`支付事务失败`, e);
            return {
                success: false,
                errMsg: `订单操作失败：${e.message}`
            };
        }

    } else if (action === 'cancel') {
        // ==================== 取消逻辑 (保持非事务) ====================
        if (order.orderStatus !== '待支付') {
            return { success: false, errMsg: `订单状态错误，当前状态为: ${order.orderStatus}，不可取消` };
        }
        
        const updateData = {
            orderStatus: '已取消',
            updateTime: db.serverDate(),
        };
        
        try {
            await db.collection(ORDER_COLLECTION).doc(orderId).update({
                data: updateData
            });

            return {
                success: true,
                errMsg: '订单已成功取消'
            };
        } catch (e) {
            console.error(`取消操作失败`, e);
            return {
                success: false,
                errMsg: `取消订单失败：${e.errMsg || e}`
            };
        }

    } else {
        return { success: false, errMsg: '无效的操作类型 (action)' };
    }
};