const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// --- 集合名称常量 ---
const MEALS_ORDER_COLLECTION = 'meals_order';
const SEATS_BOOK_COLLECTION = 'seats_book';
const SEATS_LOCK_COLLECTION = 'seats_lock';
const USER_COLLECTION = 'users';
const SCORE_HISTORY_COLLECTION = 'score_his';
const EXP_HISTORY_COLLECTION = 'exp_his';

// --- 积分/经验常量 ---
const ADD_SCORE = 10;
const ADD_EXP = 50;
const HISTORY_ACTION_NAME = "门店订单"; // ⭐ 历史记录中的 Action 名称

// --- VIP 等级所需总经验值 (与业务逻辑保持一致) ---
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
        // 在事务中调用 collection() 时需传入集合名称字符串
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
 * 统一处理订单相关操作：取消订单 (cancel) 和 模拟支付 (pay)
 */
exports.main = async (event, context) => {
    const { action, orderId, userId, totalFee } = event; 
    
    if (!orderId || !userId) {
        return {
            success: false,
            errMsg: '参数缺失：订单ID或用户ID不能为空。'
        };
    }
    
    // --- 1. 获取订单详情用于校验 (非事务) ---
    let orderRecord;
    try {
        const res = await db.collection(MEALS_ORDER_COLLECTION).doc(orderId).get(); 
        orderRecord = res.data;
    } catch (e) {
        return { success: false, errMsg: `订单查询失败：${e.errMsg}` };
    }

    if (!orderRecord) {
        return { success: false, errMsg: '未找到该订单。' };
    }

    if (orderRecord.userId !== userId) {
        return { success: false, errMsg: '权限不足：该订单不属于当前用户。' };
    }
    
    // --- 2. 根据不同的 action 执行逻辑 ---

    if (action === 'cancel') {
        // --- 取消订单逻辑 (保持原有事务逻辑) ---
        
        if (orderRecord.orderStatus !== '待支付') {
            return { success: false, errMsg: `订单状态错误：当前状态为 '${orderRecord.orderStatus}'，无法取消。` };
        }

        const transaction = await db.startTransaction();
        const currentTime = new Date(); 

        try {
            // A. 更新 meals_order 状态为 '订单取消'
            await transaction.collection(MEALS_ORDER_COLLECTION).doc(orderId).update({
                data: {
                    orderStatus: '订单取消',
                    cancelTime: currentTime, 
                    updateTime: currentTime 
                }
            });

            // B. 更新 seats_book 状态为 '失效'
            if (orderRecord.bookId) {
                await transaction.collection(SEATS_BOOK_COLLECTION).doc(orderRecord.bookId).update({
                    data: { status: '失效', updateTime: currentTime }
                });
            }

            // C. 更新 seats_lock 状态为 '失效'
            if (orderRecord.lockId) {
                await transaction.collection(SEATS_LOCK_COLLECTION).doc(orderRecord.lockId).update({
                    data: { status: '失效', updateTime: currentTime }
                });
            }

            await transaction.commit();

            return { success: true, errMsg: '订单已成功取消' };

        } catch (e) {
            await transaction.rollback();
            console.error('取消订单事务失败:', e);
            return { success: false, errMsg: `取消订单失败，请重试或联系客服。` };
        }

    } else if (action === 'pay') {
        // --- ⭐ 模拟支付逻辑 (新增事务，并集成积分/经验发放) ⭐ ---

        if (orderRecord.orderStatus !== '待支付') {
            return { success: false, errMsg: `订单状态错误：当前状态为 '${orderRecord.orderStatus}'，无需支付。` };
        }

        if (!totalFee) {
            return { success: false, errMsg: '参数缺失：支付金额 totalFee 不能为空。' };
        }
        
        // 模拟生成支付信息
        const paidAmount = totalFee; 
        const transactionId = `TID${Date.now()}${Math.floor(Math.random() * 1000)}`; 
        const paymentTime = new Date(); 
        
        const transaction = await db.startTransaction();

        try {
            // A. 事务内：更新 meals_order 状态和 payment 对象
            const updateOrderResult = await transaction.collection(MEALS_ORDER_COLLECTION).doc(orderId).update({
                data: {
                    orderStatus: '已支付',
                    updateTime: paymentTime,
                    payment: {
                        totalAmount: orderRecord.totalFee || totalFee, 
                        paidAmount: paidAmount, 
                        paymentMethod: '线上支付', 
                        paymentTime: paymentTime,
                        transactionId: transactionId 
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
                errMsg: `订单支付成功，金额：${totalFee}。积分/经验已发放。`
            };

        } catch (e) {
            await transaction.rollback();
            console.error('支付更新事务失败:', e);
            return {
                success: false,
                errMsg: `支付更新事务处理失败：${e.message}`
            };
        }

    } else {
        return {
            success: false,
            errMsg: `未知操作类型: ${action}`
        };
    }
};