// 云函数入口文件 createBooking/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

/**
 * 辅助函数：将 YYYY-MM-DD HH:MM:SS 字符串
 * 转换为代表北京时间（UTC+8）的 Date 对象。
 *
 * 做法：在日期字符串后手动添加时区偏移量 +08:00
 * 这样 new Date() 会正确解析其为指定时区的 Date 对象，解决了时区偏移问题。
 * @param {string} dateString - 格式为 YYYY-MM-DD HH:MM:SS 的日期时间字符串
 * @returns {Date} 
 */
function convertToBeiJingTime(dateString) {
    if (!dateString) return null;
    // 1. 将 '-' 替换为 '/'
    const safeString = dateString.replace(/-/g, '/');
    // 2. 手动添加时区偏移量 '+08:00'，强制 JS 引擎按 UTC+8 解析
    const beijingTimeString = `${safeString} +08:00`;
    
    // 返回一个新的 Date 对象，其内部时间戳已校正
    return new Date(beijingTimeString);
}


exports.main = async (event, context) => {
    const {
        seatId,
        seatName,
        seatDesc,
        seatType,
        comboName,
        comboPrice,
        comboDesc,
        comboType,
        userId,
        name,
        idCard,
        arrivalTime, // 传入的 YYYY-MM-DD HH:MM:SS 字符串
        phone
    } = event

    // 1. 参数校验
    if (!seatId || !userId || !arrivalTime || comboPrice === undefined || comboPrice === null) {
        return { success: false, errMsg: '缺少关键参数', code: 1 }
    }

    // 将传入的北京时间字符串转换为正确的 Date 对象
    const arrivalDateObj = convertToBeiJingTime(arrivalTime);
    if (!arrivalDateObj || isNaN(arrivalDateObj.getTime())) {
        return { success: false, errMsg: '到店时间格式错误或无效', code: 10 }
    }
    
    // 提取预订日期的字符串部分 (例如 '2025-10-22')
    const bookDateStr = arrivalTime.split(' ')[0]; 

    // 2. 检查该座位在指定日期是否已被预订或被锁定
    try {
        const transaction = await db.startTransaction()
        const bookCollection = transaction.collection('seats_book')
        const lockCollection = transaction.collection('seats_lock') // 新增：seats_lock 集合
        const orderCollection = transaction.collection('seats_order')

        // 构造当日开始时间 (UTC+8 的 00:00:00)
        const startDate = convertToBeiJingTime(`${bookDateStr} 00:00:00`); 
        // 构造当日结束时间 (UTC+8 的 23:59:59)
        const endDate = convertToBeiJingTime(`${bookDateStr} 23:59:59`); 
        
        // 构造查询条件
        const checkCondition = {
            seatId: seatId,
            status: '锁定',
            // 使用正确的 UTC+8 Date 对象进行范围查询
            bookDate: _.gte(startDate).and(_.lte(endDate))
        };

        // 检查 seats_book (已预订锁定)
        const bookingCheck = await bookCollection.where(checkCondition).get()
        
        // 检查 seats_lock (被临时锁定)
        const lockCheck = await lockCollection.where(checkCondition).get() // 新增查询

        if (bookingCheck.data.length > 0 || lockCheck.data.length > 0) {
            await transaction.rollback()
            return { success: false, errMsg: '该座位在当天已被预订或被锁定', code: 2 }
        }

        // 生成唯一订单号的逻辑
        let orderNo = '';
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;
        while (!isUnique && attempts < maxAttempts) {
            const candidateNo = `${Date.now()}${Math.floor(Math.random() * 900) + 100}`;
            const existingOrder = await orderCollection.where({ no: candidateNo }).count();
            if (existingOrder.total === 0) {
                orderNo = candidateNo;
                isUnique = true;
            }
            attempts++;
        }
        if (!isUnique) {
            await transaction.rollback();
            return { success: false, errMsg: '系统繁忙，请稍后重试', code: 5 };
        }

        // 3. 锁定座位 (在 seats_book 集合中创建记录)
        const bookResult = await bookCollection.add({
            data: {
                seatId: seatId,
                userId: userId,
                bookDate: arrivalDateObj, // 使用已校正时区的 Date 对象
                status: '锁定'
            }
        })
        if (!bookResult._id) {
            await transaction.rollback();
            return { success: false, errMsg: '锁定座位失败', code: 4 }
        }

        // 4. 创建订单
        // createTime/updateTime 使用默认的 new Date() 记录精确的 UTC 时间戳
        const now = new Date(); 
        const orderData = {
            no: orderNo,
            bookId: bookResult._id,
            orderStatus: '待支付',
            createTime: now,
            updateTime: now,
            userId: userId,
            name: name,
            phone: phone,
            idCard: idCard,
            arrivalTime: arrivalDateObj, // 使用已校正时区的 Date 对象

            seatInfo: {
                id: seatId,
                name: seatName,
                description: seatDesc || '未知',
                seatType: seatType
            },
            comboInfo: {
                name: comboName,
                price: comboPrice,
                description: comboDesc,
                comboType: comboType
            },
            payment: {
                totalAmount: comboPrice,
                paidAmount: 0,
                paymentMethod: null,
                paymentTime: null,
                transactionId: null,
            }
        };

        const orderResult = await orderCollection.add({ data: orderData })

        if (orderResult._id) {
            await transaction.commit()
            return {
                success: true,
                errMsg: '预订成功，等待支付',
                code: 0,
                data: {
                    orderId: orderResult._id
                }
            }
        } else {
            await transaction.rollback()
            return { success: false, errMsg: '创建订单失败', code: 3 }
        }
    } catch (e) {
        console.error('数据库事务执行失败:', e)
        // 尝试回滚以防万一事务未完成，虽然在 catch 中通常是自动回滚的，但显式操作更安全
        try {
            await db.rollbackTransaction(); 
        } catch (rollbackErr) {
            console.error('回滚事务失败:', rollbackErr);
        }
        return { success: false, errMsg: '服务器开小差了，请稍后重试', error: e, code: -1 }
    }
}