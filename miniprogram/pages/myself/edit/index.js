// pages/myself/profile/index.js
const SMS_CODE = '888888'; // 固定模拟验证码 (仅用于前端校验模拟)
const USER_INFO_CACHE_KEY = 'userInfo'; // 缓存键名

Page({
    data: {
        userInfo: {
            avatarUrl: '', // 头像必须存在，从缓存加载
            mobile: '',
            mobileMask: '',
        },
        formData: {
            nickname: '',
            gender: 'male',
            birthday: '',
            newMobile: '', 
            smsCode: '',
        },
        today: '',
        countdown: 0,
        timer: null,
        showMobileChangeForm: false, 
        isNewMobileValid: false, 
        isSubmitting: false, // 【新增】控制提交按钮的禁用状态
    },

    onLoad() {
        this.setData({
            today: new Date().toISOString().split('T')[0]
        });
        this.loadUserInfoFromCache();
    },
    
    // 从缓存加载用户信息 (已修正字段映射)
    loadUserInfoFromCache() {
        try {
            const cachedInfo = wx.getStorageSync(USER_INFO_CACHE_KEY); 
            
            if (cachedInfo) {
                console.log('从缓存加载到用户信息:', cachedInfo);

                // *** 关键修改：修正字段映射 ***
                const mobile = cachedInfo.phone || ''; // 映射 cachedInfo.phone -> mobile
                const mobileMask = mobile ? mobile.substring(0, 3) + '****' + mobile.substring(7) : '';
                
                this.setData({
                    // 1. 更新 userInfo
                    'userInfo.avatarUrl': cachedInfo.avatar || '', // 映射 cachedInfo.avatar -> userInfo.avatarUrl
                    'userInfo.mobile': mobile,
                    'userInfo.mobileMask': mobileMask,
                    
                    // 2. 更新 formData 初始值
                    'formData.nickname': cachedInfo.name || '', // 映射 cachedInfo.name -> formData.nickname
                    'formData.gender': cachedInfo.gender || 'male', // 假设 gender 字段名不变
                    'formData.birthday': cachedInfo.birthday || this.data.today, // 假设 birthday 字段名不变
                    
                    showMobileChangeForm: !mobile // phone: null -> mobile: '' -> showMobileChangeForm: true (正确)
                });
            } else {
                console.log('本地缓存中没有找到用户信息，使用默认值');
                this.setData({
                    'formData.birthday': this.data.today,
                    showMobileChangeForm: true 
                });
            }
        } catch (e) {
            console.error('读取缓存失败', e);
            this.setData({
                'formData.birthday': this.data.today,
                showMobileChangeForm: true
            });
        }
    },
    
    // 手机号验证函数
    validateMobile(mobile) {
        return mobile && mobile.length === 11 && /^1[3-9]\d{9}$/.test(mobile);
    },

    // 更新手机号校验结果到 data
    updateMobileValidation() {
        const newMobile = this.data.formData.newMobile;
        const isValid = this.validateMobile(newMobile);
        this.setData({
            isNewMobileValid: isValid
        });
    },

    // 监听输入框变化
    handleInput(e) {
        const { field } = e.currentTarget.dataset;
        this.setData({
            [`formData.${field}`]: e.detail.value
        });
        
        if (field === 'newMobile') {
            this.updateMobileValidation();
        }
    },

    // 监听单选框变化
    handleRadioChange(e) {
        this.setData({
            'formData.gender': e.detail.value
        });
    },

    // 监听日期选择器变化
    handlePickerChange(e) {
        this.setData({
            'formData.birthday': e.detail.value
        });
    },

    // 点击“更换手机号”按钮，显示输入区域
    toggleMobileChange() {
        this.setData({
            showMobileChangeForm: true,
            'formData.newMobile': '', 
            'formData.smsCode': '' 
        }, () => {
            this.updateMobileValidation();
        });
    },

    // 发送短信验证码
    sendSmsCode() {
        const { newMobile } = this.data.formData;
        
        if (!this.validateMobile(newMobile)) {
            wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
            return;
        }

        console.log(`模拟发送短信到: ${newMobile}, 验证码: ${SMS_CODE}`);
        // 生产环境这里需要调用云函数，触发真实的短信发送服务
        wx.showToast({ title: `模拟发送成功, 验证码: ${SMS_CODE}`, icon: 'none', duration: 3000 });

        // 开始倒计时
        this.setData({ countdown: 60 });
        this.startCountdown();
    },

    // 倒计时逻辑
    startCountdown() {
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }
        const timer = setInterval(() => {
            if (this.data.countdown > 1) {
                this.setData({
                    countdown: this.data.countdown - 1
                });
            } else {
                clearInterval(timer);
                this.setData({
                    countdown: 0,
                    timer: null
                });
            }
        }, 1000);
        this.setData({ timer });
    },

    // 提交表单 (保存) - **已修改为对接云函数**
    submitForm() {
        const { nickname, newMobile, smsCode, gender, birthday } = this.data.formData;
        const { mobile, avatarUrl } = this.data.userInfo;
        const { showMobileChangeForm } = this.data;

        // 【新增】如果正在提交中，直接返回，防止重复点击
        if (this.data.isSubmitting) {
            console.log('正在提交中，请勿重复点击');
            return;
        }

        // 1. 验证必填项
        if (!nickname.trim()) {
            wx.showToast({ title: '昵称不能为空', icon: 'none' });
            return;
        }

        // 2. 手机号和验证码校验 (仅在未绑定或点击更换时校验)
        if (!mobile || showMobileChangeForm) {
            if (!this.validateMobile(newMobile)) {
                 wx.showToast({ title: '请输入有效的新手机号', icon: 'none' });
                 return;
            }
            // 【前端校验模拟】
            if (smsCode !== SMS_CODE) {
                wx.showModal({
                    title: '验证失败',
                    content: `验证码错误，模拟正确验证码为：${SMS_CODE}`,
                    showCancel: false
                });
                return;
            }
        }
        
        // 3. 构建发送给云函数的数据
        const payload = {
            nickname: nickname,
            gender: gender,
            birthday: birthday,
            avatarUrl: avatarUrl,
        };
        
        // 如果更换/绑定了手机号，则添加新的手机号（云函数不再需要 smsCode）
        if (!mobile || showMobileChangeForm) {
            payload.newMobile = newMobile;
        }
        
        // 【修改】设置提交状态为 true
        this.setData({ isSubmitting: true }); 

        wx.showLoading({ title: '保存中...', mask: true });

        // 4. 调用云函数更新数据
        wx.cloud.callFunction({
            name: 'updateProfile', 
            data: payload,
            success: (res) => {
                wx.hideLoading();

                if (res.result && res.result.success) {
                    const { userInfo: updatedInfo } = res.result; 

                    // 5. 更新本地缓存
                    try {
                        // 使用服务器返回的最新数据更新本地缓存
                        wx.setStorageSync(USER_INFO_CACHE_KEY, updatedInfo);
                        console.log('用户信息已由服务器响应更新并存入缓存', updatedInfo);
                    } catch (e) {
                        console.error('写入缓存失败', e);
                    }
                    
                    // 6. 更新页面状态 (根据服务器返回的数据进行映射)
                    const newMobile = updatedInfo.phone || '';
                    const newMobileMask = newMobile ? newMobile.substring(0, 3) + '****' + newMobile.substring(7) : '';
                    
                    this.setData({
                        // 更新 userInfo
                        'userInfo.avatarUrl': updatedInfo.avatar || '',
                        'userInfo.mobile': newMobile,
                        'userInfo.mobileMask': newMobileMask,
                        
                        // 更新 formData 初始值
                        'formData.nickname': updatedInfo.name || '',
                        'formData.gender': updatedInfo.gender || 'male',
                        'formData.birthday': updatedInfo.birthday || this.data.today,
                        'formData.newMobile': '', // 清空新手机号输入
                        'formData.smsCode': '',   // 清空验证码输入
                        
                        // 隐藏手机号更换表单 (如果成功更新)
                        showMobileChangeForm: false
                    });
                    
                    // 清除倒计时
                    if(this.data.timer) {
                        clearInterval(this.data.timer);
                        this.setData({ countdown: 0, timer: null });
                    }

                    wx.showToast({ title: '保存成功！', icon: 'success' });
                    
                    setTimeout(() => {
                      // 【修改】在跳转前恢复按钮状态（虽然马上要跳转，但这是规范做法）
                      this.setData({ isSubmitting: false }); 
                      wx.navigateBack({
                          delta: 1 // 返回上一个页面
                      });
                      }, 1500); 

                } else {
                    // 【修改】失败时恢复按钮状态
                    this.setData({ isSubmitting: false }); 
                    wx.showModal({
                        title: '保存失败',
                        content: res.result ? res.result.message : '服务器返回错误，请稍后重试。',
                        showCancel: false
                    });
                }
            },
            fail: (e) => {
                wx.hideLoading();
                // 【修改】失败时恢复按钮状态
                this.setData({ isSubmitting: false }); 
                console.error('调用云函数失败', e);
                wx.showToast({ title: '网络请求失败，请检查网络后重试', icon: 'none' });
            }
        });
    },

    // 退出登录
    logout() {
        wx.showModal({
            title: '确认退出',
            content: '确定要退出当前账号吗？',
            success(res) {
                if (res.confirm) {
                    console.log('执行退出登录操作，清理缓存...');
                    wx.removeStorageSync(USER_INFO_CACHE_KEY); 
                    wx.showToast({ title: '已退出', icon: 'none' });
                    // TODO: 实际应用中，这里应跳转到登录页或首页
                }
            }
        });
    },

    // 模拟选择头像
    chooseAvatar() {
        // 生产环境需要先将临时文件上传到云存储，并获取永久 URL
        wx.chooseMedia({
            count: 1,
            mediaType: ['image'],
            success: (res) => {
                const tempFilePath = res.tempFiles[0].tempFilePath;
                this.setData({
                    'userInfo.avatarUrl': tempFilePath
                });
                wx.showToast({ title: '头像已选择', icon: 'none' });
            }
        });
    },

    // 页面卸载时清除计时器
    onUnload() {
        if (this.data.timer) {
            clearInterval(this.data.timer);
        }
    },
    
    // 初始化时确保手机号校验状态更新
    onReady() {
        this.updateMobileValidation();
    }
});