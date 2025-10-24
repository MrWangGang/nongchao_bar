// components/authorize/authorize.js

// ===============================================
// ⭐ 核心登录服务逻辑 (AUTH CORE) ⭐
// ===============================================

const CLOUD_FUNCTION_NAME = 'auth';
// 建议将默认头像放到你的云存储中，而不是用微信的临时链接
const DEFAULT_AVATAR_URL = 'https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0';

/**
 * 检查本地缓存中是否存在Token，判断登录状态
 */
const checkLoginStatus = () => {
  const token = wx.getStorageSync('userToken');
  return !!token; // 返回 true 或 false
};

/**
 * 封装：调用云函数进行登录和Token获取
 * @param {object} userInfo - 包含 nickName 和 avatarUrl 的用户信息对象
 * @param {function} finalSuccessCallback - 登录流程全部成功后的回调
 */
const callCloudLogin = (userInfo, finalSuccessCallback) => {
    wx.showLoading({ title: '正在登录...' });

    wx.cloud.callFunction({
        name: CLOUD_FUNCTION_NAME,
        data: {
            nickName: userInfo.nickName,
            avatarUrl: userInfo.avatarUrl
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
* @param {object} userInfo - 包含 nickName 和 avatarUrl 的用户信息对象
* @param {function} finalSuccessCallback - 登录流程全部成功后的回调
*/
const checkAndAuthorize = (userInfo, finalSuccessCallback) => {
    
    // 1. 发起 wx.login 获取 code (云函数会自动使用这个code)
    wx.login({
        success: () => {
            // 2. 授权成功后，立即调用云函数进行后端登录
            callCloudLogin(userInfo, finalSuccessCallback);
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
            this.setData({ authAvatarUrl: avatarUrl });
            wx.showToast({ title: '头像已选定', icon: 'none' });
        },

        onNicknameInput(e) {
            this.setData({ authNickName: e.detail.value.trim() });
        },

        submitAuthAndLogin() {
            const { authAvatarUrl, authNickName, defaultAvatarUrl } = this.data;

            if (authAvatarUrl === defaultAvatarUrl) {
                wx.showToast({ title: '请选择头像', icon: 'none' });
                return;
            }
            if (!authNickName) {
                wx.showToast({ title: '昵称不能为空', icon: 'none' });
                return;
            }
            
            // 构造用户信息
            const userInfo = { nickName: authNickName, avatarUrl: authAvatarUrl };
            
            // 调用核心登录流程，并把组件的 handleLoginSuccess 作为最终成功回调传进去
            checkAndAuthorize(userInfo, this.handleLoginSuccess.bind(this));
        },
        
        /**
         * 【核心修改】
         * 登录流程完全成功后的处理函数
         * 不再触发事件，而是调用 app.js 的全局方法
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