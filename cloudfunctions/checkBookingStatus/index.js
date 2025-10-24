// 云函数入口文件 checkBookingStatus/index.js
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV 
})

const db = cloud.database()
const _ = db.command

// 时间格式化函数，方便查看
function formatToCST(date) {
    return new Date(date).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
}

// 云函数入口函数
exports.main = async (event, context) => {
    // 接收当前用户ID和座位编码
    const { seatCode, currentUserId } = event 

    if (!seatCode || !currentUserId) {
        return { success: false, message: '缺少 seatCode 或 currentUserId 参数', status: 'ERROR' }
    }

    try {
        // 1. 用编码(seatCode)换取真正的seatId
        console.log(`[调试] 接收到 seatCode: ${seatCode}, currentUserId: ${currentUserId}`);
        const seatInfoResult = await db.collection('seats').where({
            name: seatCode 
        }).limit(1).get();

        if (seatInfoResult.data.length === 0) {
            return {
                success: false,
                status: 'INVALID_CODE',
                message: '无效的座位编码'
            }
        }
        const seatId = seatInfoResult.data[0]._id;
        // --- 1. 编码转换结束 ---

        // 2. 构造今天的查询时间范围 (CST/UTC+8)
        const now = new Date();
        const todayCSTString = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Shanghai' });
        const startOfDay = new Date(`${todayCSTString}T00:00:00.000+08:00`); 
        const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000 - 1);

        const commonQuery = {
            seatId: seatId,
            status: '锁定',
            bookDate: _.gte(startOfDay).and(_.lte(endOfDay))
        };
        // --- 2. 时间范围结束 ---

        let finalStatus = 'AVAILABLE'; // 默认状态
        let bookedRecord = null; // 存储预订记录

        // 3. 检查 seats_book (预订记录)
        const bookQueryResult = await db.collection('seats_book').where(commonQuery).limit(1).get();

        if (bookQueryResult.data.length > 0) {
            bookedRecord = bookQueryResult.data[0];
            const bookUserId = bookedRecord.userId;
            const bookDate = bookedRecord.bookDate;

            // 逻辑 A: 优先级 1 - 如果是用户自己的预订
            if (bookUserId === currentUserId) {
                finalStatus = 'LOCKED_BUT_SELF_AVAILABLE_TEMP'; // <-- 新增状态
                console.log('[调试] 找到用户自己的预订记录，判定为用户自用临时可用。');
            } else {
                // 逻辑 B: 优先级 2 - 其他人的预订，执行时间判断
                const currentTimeForCompare = new Date();
                const twoHoursInMs = 2 * 60 * 60 * 1000;
                const vacateTime = new Date(bookDate.getTime() - twoHoursInMs);
                const isTempAvailable = currentTimeForCompare < vacateTime;

                if (isTempAvailable) {
                    finalStatus = 'LOCKED_BUT_AVAILABLE_TEMP';
                    console.log('[调试] 找到他人预订记录，仍可临时使用。');
                } else {
                    finalStatus = 'LOCKED_UNAVAILABLE';
                    console.log('[调试] 找到他人预订记录，已进入保留期，判定为不可用。');
                    
                    // 如果已进入保留期，直接返回结果，无需检查 seats_lock
                    return {
                        success: true,
                        status: finalStatus,
                        message: '座位已进入预订保留期，无法使用',
                        bookDate: bookDate,
                    }
                }
            }
        } 
        // --- 3. seats_book 检查结束 ---

        
        // 4. 检查 seats_lock (临时锁定记录) - 汇集所有逻辑分支后执行
        const lockQueryResult = await db.collection('seats_lock').where(commonQuery).limit(1).get();

        if (lockQueryResult.data.length > 0) {
            const lockRecord = lockQueryResult.data[0];
            const lockUserId = lockRecord.userId;

            // 逻辑 C & D: 优先级 3 - 检查临时锁定
            if (lockUserId !== currentUserId) {
                // 被他人临时锁定，优先级最高，覆盖所有前面的临时可用状态
                finalStatus = 'LOCKED_UNAVAILABLE';
                console.log('[调试] 找到他人临时锁定记录，判定为不可用 (覆盖)。');
                
                return {
                    success: false, // 被他人锁定，返回 false 更符合业务错误
                    status: finalStatus,
                    message: '该座位当前正被其他用户临时锁定，无法使用',
                }
            } else {
                // 被自己临时锁定 (lockUserId === currentUserId)
                if (finalStatus === 'AVAILABLE') {
                    // 如果 seats_book 没记录，但 seats_lock 有自己的记录
                    finalStatus = 'LOCKED_BUT_SELF_AVAILABLE_TEMP'; // <-- 新增状态
                    console.log('[调试] 找到用户自己的临时锁定记录，判定为用户自用临时可用。');
                }
                // 如果 finalStatus 已经是 LOCKED_BUT_SELF_AVAILABLE_TEMP 或 LOCKED_BUT_AVAILABLE_TEMP，则保持不变。
            }
        }
        // --- 4. seats_lock 检查结束 ---


        // 5. 返回最终判定状态
        
        let message = '';
        let result = {
            success: true,
            status: finalStatus,
            message: '',
        };
        
        if (finalStatus === 'AVAILABLE') {
            message = '座位可用';
        } else if (finalStatus === 'LOCKED_BUT_AVAILABLE_TEMP') {
            // bookQueryResult 此时一定有值
            const vacateTime = new Date(bookedRecord.bookDate.getTime() - 2 * 60 * 60 * 1000);
            message = '座位已被预订，但可临时使用';
            result.vacateTime = vacateTime;
            result.bookDate = bookedRecord.bookDate;
        } else if (finalStatus === 'LOCKED_BUT_SELF_AVAILABLE_TEMP') {
            // bookQueryResult 或 lockQueryResult 此时一定有自己的锁定记录
            message = '座位已被您本人预订或锁定，可使用';
            if(bookedRecord) {
                // 如果是自己的预订，仍然返回清场时间给前端做参考提示
                const vacateTime = new Date(bookedRecord.bookDate.getTime() - 2 * 60 * 60 * 1000);
                result.vacateTime = vacateTime;
                result.bookDate = bookedRecord.bookDate;
            }
        }
        
        result.message = message;
        return result;

    } catch (e) {
        console.error('查询数据库出错', e)
        return {
            success: false,
            message: '查询数据库时发生错误',
            status: 'ERROR',
            error: e
        }
    }
}