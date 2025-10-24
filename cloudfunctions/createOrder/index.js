// cloud/createOrder/index.js

const cloud = require('wx-server-sdk');

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
});

const db = cloud.database();
const _ = db.command;

// 定义常量
const SEATS_COLLECTION = 'seats';
const SEATS_LOCK_COLLECTION = 'seats_lock'; // 使用 seats_lock 集合
const ORDERS_COLLECTION = 'meals_order';
// 修正：订单状态使用中文字符串 '待支付'
const ORDER_STATUS_PENDING_PAYMENT = '待支付'; // '待支付', '已支付', '订单取消'

/**
 * 辅助函数：生成唯一的订单编号 (包含查库校验)
 * @returns {string} 唯一订单号
 */
async function generateUniqueOrderId() {
    let newOrderId = '';
    let isUnique = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 5; 

    while (!isUnique && attempts < MAX_ATTEMPTS) {
        // 使用时间戳后10位 + 4位随机数
        const dateStr = new Date().getTime().toString().slice(-10);
        const randomStr = Math.floor(Math.random() * 9000 + 1000);
        newOrderId = dateStr + randomStr.toString();
        
        // 查询数据库检查重复
        const checkRes = await db.collection(ORDERS_COLLECTION)
            .where({
                no: newOrderId
            })
            .count(); 
            
        if (checkRes.total === 0) {
            isUnique = true;
        } else {
            attempts++;
            console.warn(`订单号 ${newOrderId} 已存在，尝试重新生成。`);
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }
    }

    if (!isUnique) {
        throw new Error("无法在多次尝试内生成唯一订单编号，请稍后重试。");
    }

    return newOrderId;
}


exports.main = async (event, context) => {
    const { finalOrder, userId } = event; 
    const { seatCode, totalPrice, totalCount, remark, products } = finalOrder;
    
    if (!userId) {
        return { success: false, errMsg: '用户ID缺失，请确保前端已获取并传入 userId' };
    }
    
    const now = new Date(); // 统一时间戳
    let currentLockId = null; // 用于存储 seats_lock 的 ID，以便失败时回滚
    let newOrderId = ''; // 提前声明 newOrderId

    try {
        // 1. 【用户防重】：检查用户是否有待支付订单
        const pendingOrderRes = await db.collection(ORDERS_COLLECTION)
            .where({
                userId: userId, 
                orderStatus: ORDER_STATUS_PENDING_PAYMENT // 使用中文状态
            })
            .limit(1)
            .get();

        if (pendingOrderRes.data.length > 0) {
            const existingOrder = pendingOrderRes.data[0];
            return { 
                success: false, 
                errMsg: `您存在待支付订单（${existingOrder.no}），请先完成支付或取消`,
                existingOrderId: existingOrder._id 
            };
        }
        
        
        // 2. 【获取座位详情】：查找 seats 表获取桌位详情 
        const seatRes = await db.collection(SEATS_COLLECTION)
            .where({ name: seatCode })
            .limit(1)
            .get();
        
        if (seatRes.data.length === 0) {
            return { success: false, errMsg: '找不到对应的桌位信息' };
        }
        const seatInfo = seatRes.data[0];
        const seatId = seatInfo._id;


        // 3. 【临时锁定】：在 seats_lock 中插入记录
        const lockData = {
            seatId: seatId,
            status: '锁定',
            userId: userId, 
            bookDate: now, // 视为临时占用的起始时间
            createTime: now 
        };
        const lockResult = await db.collection(SEATS_LOCK_COLLECTION).add({ data: lockData });
        currentLockId = lockResult._id; // 存储锁记录的 ID


        // 4. 【创建订单】：生成订单信息并插入 meals_order 表
        newOrderId = await generateUniqueOrderId(); // 获取订单号
        const { _id, ...seatDisplayInfo } = seatInfo; // 排除 _id，只保留座位信息用于展示
        
        const orderData = {
            no: newOrderId, // 订单号
            userId: userId, 
            orderStatus: ORDER_STATUS_PENDING_PAYMENT, // 使用中文状态 '待支付'
            totalCount: totalCount, 
            remark: remark,
            
            // 绑定 seats_lock 的 ID
            lockId: currentLockId, 
            // 新增 bookId 字段，默认为 null
            bookId: null, 
            
            payment: {
                paidAmount: 0, 
                paymentMethod: null,
                paymentTime: null,
                totalAmount: totalPrice, 
                transactionId: null
            },
            
            createTime: now, 
            updateTime: now, 
            
            products: products,
            seatInfo: seatDisplayInfo,
        };

        const result = await db.collection(ORDERS_COLLECTION).add({ data: orderData });

        // 5. 【返回结果】：返回新订单ID (_id) 和订单号 (no)
        return {
            success: true,
            orderId: result._id,   // 返回数据库 ID (_id)
            orderNo: newOrderId,   // 返回订单号 (no)
            lockId: currentLockId
        };

    } catch (e) {
        console.error('订单创建失败', e);
        
        // 关键：如果订单创建失败，尝试清除刚才在 seats_lock 中插入的记录
        if (currentLockId) {
            try {
                 await db.collection(SEATS_LOCK_COLLECTION).doc(currentLockId).remove();
            } catch(removeErr) {
                 console.error('订单失败后回滚 seats_lock 失败', removeErr);
            }
        }
        
        return {
            success: false,
            errMsg: `订单创建失败: ${e.message || '数据库操作错误'}`
        };
    }
};