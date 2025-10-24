// 云函数入口文件 (例如: getSeats/index.js)
const cloud = require('wx-server-sdk')

cloud.init({
    env: cloud.DYNAMIC_CURRENT_ENV // 建议使用动态环境
})

// 获取数据库引用
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
    // 从前端接收一个日期参数，例如 '2023-10-27'
    const { date } = event

    // 如果前端没有传递日期，则无法查询预订状态，返回错误
    if (!date) {
        return {
            code: -1,
            message: '查询失败，缺少日期参数',
        }
    }

    try {
        // 1. 获取所有座位的基础信息
        const seatsResult = await db.collection('seats').get()
        const allSeats = seatsResult.data

        // 如果一个座位都没有，直接返回空数组
        if (allSeats.length === 0) {
            return {
                code: 0,
                message: '查询成功',
                data: []
            }
        }

        // 2. 构造当日查询的开始和结束时间（使用辅助函数确保时区正确）
        const bookDateStart = convertToBeiJingTime(`${date} 00:00:00`)
        const bookDateEnd = convertToBeiJingTime(`${date} 23:59:59`)

        // 构造查询条件
        const commonCondition = {
            status: '锁定',
            bookDate: _.gte(bookDateStart).and(_.lte(bookDateEnd))
        }

        // 3. 查询 seats_book 中当天所有状态为“锁定”的预订记录
        const bookingsResult = await db.collection('seats_book').where(commonCondition).get()
        
        // 4. 查询 seats_lock 中当天所有状态为“锁定”的临时锁定记录
        const locksResult = await db.collection('seats_lock').where(commonCondition).get()
        
        // 5. 合并已占用座位的 ID 列表
        const allOccupiedRecords = [
            ...bookingsResult.data, 
            ...locksResult.data // 新增：合并 seats_lock 的结果
        ];

        // 6. 将所有已占用的 seatId 提取到一个 Set 中，便于快速查找
        const occupiedSeatIds = new Set(allOccupiedRecords.map(item => item.seatId));

        // 7. 遍历所有座位，添加 isBooked 状态
        const seatsWithStatus = allSeats.map(seat => {
            return {
                ...seat, // 保留座位原有所有信息
                // 检查当前座位的 _id 是否在已占用的 Set 中
                isBooked: occupiedSeatIds.has(seat._id) 
            }
        })

        // 8. 返回带有预订状态的座位列表
        return {
            code: 0,
            message: '查询成功',
            data: seatsWithStatus
        }

    } catch (err) {
        console.error('查询座位状态失败:', err)
        return {
            code: -1,
            message: '查询失败，数据库操作异常',
            error: err
        }
    }
}