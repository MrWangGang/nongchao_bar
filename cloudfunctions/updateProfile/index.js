const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) 

const db = cloud.database()
const userCollection = db.collection('users') 

/**
 * 内部函数：验证手机号格式
 */
function validateMobile(mobile) {
    // 手机号格式验证依然保留，确保数据清洁
    return mobile && mobile.length === 11 && /^1[3-9]\d{9}$/.test(mobile);
}

/**
 * 云函数入口函数：更新用户个人资料
 */
exports.main = async (event, context) => {
    
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID 
    
    if (!openid) {
        return { success: false, message: '用户未登录或会话已过期。' }
    }
    
    // 1. 提取传入数据
    const { 
        nickname, 
        gender, 
        birthday, 
        avatarUrl, 
        newMobile, 
        // 移除 smsCode，因为它只在前端用于模拟校验
    } = event; 

    // 2. 验证基础字段
    if (!nickname || !gender || !birthday) {
        return { success: false, message: '昵称、性别、生日为必填项。' }
    }
    
    try {
        // 3. 查找用户记录
        const userRecord = await userCollection.where({ openid }).get();
        if (userRecord.data.length === 0) {
            return { success: false, message: '找不到用户记录。' }
        }
        
        const existingData = userRecord.data[0];
        const updateData = {};
        let finalPhone = existingData.phone; 

        // 4. 处理手机号更新/绑定逻辑 (信任前端已校验验证码)
        if (newMobile) {
            if (!validateMobile(newMobile)) {
                 // 即使信任前端校验，服务器端仍需做基本的格式校验
                return { success: false, message: '手机号格式不正确。' }
            }
            
            // 【关键修改】直接执行手机号更新 (假设验证码已在前端校验通过)
            updateData.phone = newMobile;
            finalPhone = newMobile; // 更新返回给前端的手机号
            
            console.log(`用户 [${openid}] 手机号更新/绑定为: ${newMobile}`);
        }

        // 5. 构建其他更新字段
        updateData.nickName = nickname;
        updateData.gender = gender;
        updateData.birthday = birthday;
        updateData.avatarUrl = avatarUrl; 
        updateData.updatedAt = db.serverDate();

        // 6. 执行数据库更新
        await userCollection.doc(existingData._id).update({
            data: updateData
        });
        
        // 7. 构造返回给前端的完整用户信息
        const userToReturn = { 
            name: nickname, 
            avatar: avatarUrl, 
            phone: finalPhone, 
            userId: existingData._id, 
            userNum: existingData.userNum,
            vipLevel: existingData.vipLevel, 
            vipType: existingData.vipType,
            vipScore: existingData.vipScore, 
            vipExp: existingData.vipExp,
            board: existingData.board,                   
            boardUrl: existingData.boardUrl,
            gender: gender,                  
            birthday: birthday               
        };

        // 8. 返回成功响应
        return {
            success: true,
            message: '个人资料更新成功！',
            userInfo: userToReturn 
        }

    } catch (e) {
        console.error('更新个人资料失败:', e)
        return { success: false, message: '服务器处理失败：数据库或内部错误。' }
    }
}