// 云函数入口文件
const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();
const _ = db.command;

/**
 * 模拟支付和取消订单功能集成云函数
 * @param {object} event - 客户端调用时传入的参数
 * @param {string} event.action - 执行的操作类型 ('pay' 或 'cancel')
 * @param {string} event.orderId - 订单的数据库 ID (_id)
 * @param {string} [event.transactionId] - (仅 'pay' 操作需要) 模拟的支付交易 ID
 * @param {string} [event.paymentMethod] - (仅 'pay' 操作需要) 支付方式
 */
exports.main = async (event, context) => {
    const { action, orderId, transactionId, paymentMethod } = event;
    
    if (!orderId) {
        return { success: false, errMsg: '缺少订单 ID' };
    }

    try {
        // 1. 查找订单并获取当前状态和总金额
        const orderRes = await db.collection('cocktails_order').doc(orderId).get();
        const order = orderRes.data;

        if (!order) {
            return { success: false, errMsg: '订单不存在' };
        }

        let updateData = {};
        let successMsg = '';

        // 2. 根据 action 分发任务
        if (action === 'pay') {
            // ==================== 支付逻辑 ====================
            if (!transactionId || !paymentMethod) {
                return { success: false, errMsg: '支付操作缺少交易 ID 或支付方式' };
            }

            if (order.orderStatus !== '待支付') {
                return { success: false, errMsg: `订单状态错误，当前状态为: ${order.orderStatus}，无法支付` };
            }
            
            const totalAmount = order.payment.totalAmount; // 沿用订单创建时的金额

            updateData = {
                orderStatus: '已支付',
                updateTime: db.serverDate(),
                payment: {
                    paymentMethod: paymentMethod,
                    paymentTime: db.serverDate(),
                    totalAmount: totalAmount,
                    transactionId: transactionId,
                }
            };
            successMsg = '支付成功，订单状态已更新';

        } else if (action === 'cancel') {
            // ==================== 取消逻辑 ====================
            if (order.orderStatus !== '待支付') {
                return { success: false, errMsg: `订单状态错误，当前状态为: ${order.orderStatus}，不可取消` };
            }
            
            updateData = {
                orderStatus: '已取消',
                updateTime: db.serverDate(),
            };
            successMsg = '订单已成功取消';

        } else {
            return { success: false, errMsg: '无效的操作类型 (action)' };
        }

        // 3. 执行数据库更新
        await db.collection('cocktails_order').doc(orderId).update({
            data: updateData
        });

        return {
            success: true,
            errMsg: successMsg
        };

    } catch (e) {
        console.error(`执行操作 [${action}] 失败`, e);
        return {
            success: false,
            errMsg: `订单操作失败：${e.errMsg || e}`
        };
    }
};