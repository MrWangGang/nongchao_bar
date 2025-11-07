// components/authorize/authorize.js

// ===============================================
// ⭐ 核心登录服务逻辑 (AUTH CORE) ⭐
// ===============================================

const CLOUD_FUNCTION_NAME = 'auth';
// 【重要修改】请将此默认头像替换为您云存储中的永久图片链接
const DEFAULT_AVATAR_URL = 'cloud://cloud1-7gy6iiv5f0cbcb43.636c-cloud1-7gy6iiv5f0cbcb43-1379173903/素材/默认头像.png';

/**
 * 检查本地缓存中是否存在Token，判断登录状态
 */
const checkLoginStatus = () => {
  const token = wx.getStorageSync('userToken');
  return !!token; // 返回 true 或 false
};

/**
 * 封装：调用云函数进行登录和Token获取
 * @param {object} userInfo - 包含 nickName 和 avatarUrl (永久文件ID) 的用户信息对象
 * @param {function} finalSuccessCallback - 登录流程全部成功后的回调
 */
const callCloudLogin = (userInfo, finalSuccessCallback) => {
    wx.showLoading({ title: '正在登录...' });

    wx.cloud.callFunction({
        name: CLOUD_FUNCTION_NAME,
        data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl // 此时 avatarUrl 是永久文件 ID
        },
        success: res => {
            wx.hideLoading();
            if (res.result && res.result.success) {
                const { token, userInfo: remoteUserInfo } = res.result;

                // 1. 存储 JWT Token 和合并后的用户信息
                wx.setStorageSync('userToken', token);
                wx.setStorageSync('userInfo', remoteUserInfo);
                
                wx.showToast({ title: '登录成功', icon: 'success', duration: 1500 });
                finalSuccessCallback(); // 调用最终成功回调 (例如隐藏弹窗、通知全局)

            } else {
                const msg = res.result ? res.result.message : '服务器处理失败';
                wx.showToast({ title: msg || '登录失败', icon: 'error' });
            }
        },
        fail: err => {
            wx.hideLoading();
            console.error('云函数调用失败', err);
            wx.showToast({ title: '网络错误，请重试', icon: 'none' });
        }
    });
};


/**
* 检查登录状态并处理授权流程 (调用云函数)
* * 【关键修改】此函数现在负责将头像上传到云存储，并将永久 fileID 传递给 callCloudLogin。
* * @param {object} userInfo - 包含 nickName 和 avatarUrl (临时路径) 的用户信息对象
* @param {function} finalSuccessCallback - 登录流程全部成功后的回调
*/
const checkAndAuthorize = async (userInfo, finalSuccessCallback) => {
    
    let permanentAvatarUrl = userInfo.avatarUrl;

    // 1. 【新增】将临时头像路径上传到云存储
    // 只有当头像路径不是云存储链接 (cloud://) 或默认链接时，才需要上传
    if (!permanentAvatarUrl.startsWith('cloud://') && permanentAvatarUrl !== DEFAULT_AVATAR_URL) {
        wx.showLoading({ title: '上传头像中...' });
        try {
            // 生成唯一的云端文件路径
            const cloudPath = `user_avatars/${userInfo.nickName}_${Date.now()}.png`;
            
            const uploadRes = await wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: userInfo.avatarUrl, // 临时文件路径
            });

            permanentAvatarUrl = uploadRes.fileID; // 获取永久文件 ID
            wx.hideLoading();

        } catch (error) {
            wx.hideLoading();
            console.error('头像上传云存储失败', error);
            wx.showToast({ title: '头像上传失败，请重试', icon: 'error' });
            return; 
        }
    }
    
    // 2. 发起 wx.login 获取 code 
    wx.login({
        success: () => {
            // 3. 授权成功后，立即调用云函数进行后端登录
            const finalUserInfo = { 
                nickName: userInfo.nickName, 
                avatarUrl: permanentAvatarUrl // 传递永久链接或 Cloud File ID
            };
            callCloudLogin(finalUserInfo, finalSuccessCallback);
        },
        fail: () => {
            wx.showToast({ title: '微信登录失败', icon: 'error' });
        }
    });
};


// ===============================================
// ⭐ 组件 Component 定义 ⭐
// ===============================================

Component({
    data: {
        authAvatarUrl: DEFAULT_AVATAR_URL,
        authNickName: '',
        defaultAvatarUrl: DEFAULT_AVATAR_URL,
        isAuthModalVisible: false,
    },

    lifetimes: {
        attached() {
            // 组件被attach到页面时，检查登录状态，如果未登录则显示弹窗
            if (!checkLoginStatus()) {
                this.setData({ isAuthModalVisible: true });
            }
        }
    },

    methods: {
        onChooseAvatar(e) {
            const { avatarUrl } = e.detail;
            this.setData({ authAvatarUrl: avatarUrl }); // 此时 avatarUrl 是一个临时文件路径
            wx.showToast({ title: '头像已选定', icon: 'none' });
        },

        onNicknameInput(e) {
            this.setData({ authNickName: e.detail.value.trim() });
        },

        // 【关键修改】改为异步函数
        async submitAuthAndLogin() {
            const { authAvatarUrl, authNickName, defaultAvatarUrl } = this.data;

            if (authAvatarUrl === defaultAvatarUrl) {
                wx.showToast({ title: '请选择头像', icon: 'none' });
                return;
            }
            if (!authNickName) {
                wx.showToast({ title: '昵称不能为空', icon: 'none' });
                return;
            }
            
            // 构造用户信息 (authAvatarUrl 此时是临时路径)
            const userInfo = { nickName: authNickName, avatarUrl: authAvatarUrl };
            
            // 调用核心登录流程，checkAndAuthorize 将处理头像上传
            await checkAndAuthorize(userInfo, this.handleLoginSuccess.bind(this));
        },
        
        /**
         * 登录流程完全成功后的处理函数
         */
        handleLoginSuccess() {
            this.setData({ isAuthModalVisible: false }); 
            
            // 获取 app 实例并调用全局登录成功处理函数
            const app = getApp();
            if (app && typeof app.onLoginSuccess === 'function') {
                app.onLoginSuccess();
            }
        }
    }
});