// cloudfunctions/orderActions/index.js
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// 定义集合名称
const MEALS_ORDER_COLLECTION = 'meals_order';
const SEATS_BOOK_COLLECTION = 'seats_book';
const SEATS_LOCK_COLLECTION = 'seats_lock';

// ⭐ 【已移除 getBeijingTime() 和 convertToBeiJingTime() 辅助函数】


/**
 * 统一处理订单相关操作：取消订单 (cancel) 和 模拟支付 (pay)
 * @param {string} action - 操作类型: 'cancel' 或 'pay'
 * @param {string} orderId - 订单在 meals_order 表中的 _id
 * @param {string} userId - 当前用户的 userId (从前端缓存获取并传入)
 * @param {number} totalFee - 订单总金额 (仅 'pay' 操作需要)
 */
exports.main = async (event, context) => {
    const { action, orderId, userId, totalFee } = event; 
    
    if (!orderId || !userId) {
        return {
            success: false,
            errMsg: '参数缺失：订单ID或用户ID不能为空。'
        };
    }
    
    // --- 1. 获取订单详情用于校验 ---
    let orderRecord;
    try {
        const res = await db.collection(MEALS_ORDER_COLLECTION).doc(orderId).get(); 
        orderRecord = res.data;
    } catch (e) {
        return {
            success: false,
            errMsg: `订单查询失败：${e.errMsg}`
        };
    }

    if (!orderRecord) {
        return {
            success: false,
            errMsg: '未找到该订单。'
        };
    }

    if (orderRecord.userId !== userId) {
        return {
            success: false,
            errMsg: '权限不足：该订单不属于当前用户。'
        };
    }
    
    // --- 2. 根据不同的 action 执行逻辑 ---

    if (action === 'cancel') {
        // --- 取消订单逻辑 ---
        
        if (orderRecord.orderStatus !== '待支付') {
            return {
                success: false,
                errMsg: `订单状态错误：当前状态为 '${orderRecord.orderStatus}'，无法取消。`
            };
        }

        const transaction = await db.startTransaction();
        const currentTime = new Date(); // ⭐ 统一使用 new Date() 记录当前时间 (UTC)

        try {
            // A. 更新 meals_order 状态为 '订单取消'
            await transaction.collection(MEALS_ORDER_COLLECTION).doc(orderId).update({
                data: {
                    orderStatus: '订单取消',
                    cancelTime: currentTime, 
                    updateTime: currentTime 
                }
            });

            // B. 更新 seats_book 状态为 '失效' (如果存在 bookId)
            if (orderRecord.bookId) {
                await transaction.collection(SEATS_BOOK_COLLECTION).doc(orderRecord.bookId).update({
                    data: {
                        status: '失效',
                        updateTime: currentTime 
                    }
                });
            }

            // C. 更新 seats_lock 状态为 '失效' (如果存在 lockId)
            if (orderRecord.lockId) {
                await transaction.collection(SEATS_LOCK_COLLECTION).doc(orderRecord.lockId).update({
                    data: {
                        status: '失效',
                        updateTime: currentTime 
                    }
                });
            }

            await transaction.commit();

            return {
                success: true,
                errMsg: '订单已成功取消'
            };

        } catch (e) {
            await transaction.rollback();
            console.error('取消订单事务失败:', e);
            return {
                success: false,
                errMsg: `取消订单失败，请重试或联系客服。`
            };
        }

    } else if (action === 'pay') {
        // --- 模拟支付逻辑 ---

        if (orderRecord.orderStatus !== '待支付') {
            return {
                success: false,
                errMsg: `订单状态错误：当前状态为 '${orderRecord.orderStatus}'，无需支付。`
            };
        }

        if (!totalFee) {
            return {
                 success: false,
                errMsg: '参数缺失：支付金额 totalFee 不能为空。'
            };
        }
        
        // 模拟生成支付信息
        const paidAmount = totalFee; 
        const transactionId = `TID${Date.now()}${Math.floor(Math.random() * 1000)}`; 
        const paymentTime = new Date(); // ⭐ 统一使用 new Date() 记录当前时间 (UTC)
        
        try {
            // 更新订单状态和 payment 对象
            await db.collection(MEALS_ORDER_COLLECTION).doc(orderId).update({
                data: {
                    orderStatus: '已支付',
                    updateTime: paymentTime, // 统一使用 new Date()
                    payment: {
                        totalAmount: orderRecord.totalFee || totalFee, 
                        paidAmount: paidAmount, 
                        paymentMethod: '线上支付', 
                        paymentTime: paymentTime, // 统一使用 new Date()
                        transactionId: transactionId 
                    }
                }
            });
            
            return {
                success: true,
                errMsg: `订单支付成功，金额：${totalFee}`
            };

        } catch (e) {
            console.error('支付后更新状态失败:', e);
            return {
                success: false,
                errMsg: '支付成功，但更新订单状态失败，请联系客服。'
            };
        }

    } else {
        return {
            success: false,
            errMsg: `未知操作类型: ${action}`
        };
    }
};