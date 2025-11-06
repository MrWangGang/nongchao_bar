// cloud/claimBoard/index.js
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) 

const db = cloud.database()
const userCollection = db.collection('users') 

/**
 * 云函数入口函数：直接将前端提供的灯牌名称和图片URL更新到用户的 board 和 boardUrl 字段
 * * 注意：此函数不进行等级检查。等级检查和灯牌信息（名称/URL）的确定应在前端完成。
 * * @param {object} event - 包含 userId (_id), boardName (要佩戴的灯牌名称) 和 boardUrl (灯牌图片URL)
 */
exports.main = async (event, context) => {
    
    // userId 来自前端缓存，它就是 users 表中的 _id
    // boardName 是前端确认用户有权限佩戴后，传递过来的灯牌的显示名称
    // boardUrl 是前端确认用户有权限佩戴后，传递过来的灯牌的图片 URL
    const { userId, boardName, boardUrl } = event 
    
    // 【修改点 1】增加对 boardUrl 参数的检查
    if (!userId || !boardName || boardUrl === undefined) {
        return { success: false, message: '参数缺失 (userId, boardName, 或 boardUrl)。' }
    }
    
    try {
        // 1. 检查用户是否存在（可选，但推荐保留）
        const userRecord = await userCollection.doc(userId).get()
        if (!userRecord.data) {
             return { success: false, message: '用户不存在。' }
        }

        // 2. 更新 users 表中对应的 _id 记录的 board 和 boardUrl 字段
        // 【修改点 2】同时更新 board 和 boardUrl
        await userCollection.doc(userId).update({
            data: {
                board: boardName,    // 直接将前端传来的名称存入 board 字段
                boardUrl: boardUrl   // 【新增】将前端传来的 URL 存入 boardUrl 字段
            }
        })
        
        // 3. 返回成功信息、新的灯牌名称和 URL
        // 【修改点 3】返回新的 boardUrl
        return {
            success: true,
            message: `成功佩戴 ${boardName}！`,
            newBoardName: boardName,
            newBoardUrl: boardUrl 
        }

    } catch (e) {
        console.error(`更新灯牌失败 (userId: ${userId})：`, e)
        return { success: false, message: '服务器处理失败。' }
    }
}