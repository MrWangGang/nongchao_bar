// pages/scan/scan.js
const app = getApp(); // 在文件顶部获取 app 实例

Page({
    onShow: function () {
        if (typeof this.getTabBar === 'function' && this.getTabBar()) {
            // 这里的索引要与你在 custom-tab-bar/index.js 中 list 数组的索引对应
            // 菜单是索引 1
            this.getTabBar().setData({
                selected: 1
            })
        }
    },
    data: {
        isChecking: false
    },
    onLoad(options) {
        // 注册全局登录回调, 如果你需要在登录成功后刷新本页面的数据，请传入一个函数：
        // app.registerPageUpdateCallback(this.loadData.bind(this));
        // 目前你提供的代码中没有传入回调，保持不变。
        app.registerPageUpdateCallback(); 
    },

    /**
     * @function checkLoginBeforeAction
     * @description 检查用户是否登录，未登录则弹出提示。
     * @returns {boolean} - true 表示已登录并获取到 userId, false 表示未登录。
     */
    checkLoginBeforeAction() {
        const userInfo = wx.getStorageSync('userInfo');
        const currentUserId = userInfo ? userInfo.userId : null;

        if (!currentUserId) {
            // 【修改点】仅提示，不提供跳转按钮
            wx.showModal({
                title: '温馨提示',
                content: '请先登录您的账号，才能使用扫码功能。请返回首页登录。',
                confirmText: '好的',
                showCancel: false, // 不显示取消按钮
            });
            return false;
        }
        return true;
    },

    scanCode: function() {
        if (this.data.isChecking) return;
        
        // 【新增：强制登录校验】在扫码操作前进行登录检查
        if (!this.checkLoginBeforeAction()) {
            return; // 未登录则中断扫码流程，不弹出摄像头
        }
        // --------------------

        wx.scanCode({
            onlyFromCamera: true,
            success: (res) => {
                // 变量名改为 scannedCode
                const scannedCode = res.result; 
                this.checkBookingStatus(scannedCode);
            },
            fail: (err) => {
                console.error("扫码失败:", err);
                wx.showToast({ title: '扫码或取消', icon: 'none' });
            }
        });
    },

    /**
     * @param {string} seatCode - 扫码得到的座位编码
     */
    checkBookingStatus(seatCode) {
        if (this.data.isChecking) return;
        
        // 这里的逻辑作为二次校验（例如：防止用户信息在扫码后失效）是必要的。
        const userInfo = wx.getStorageSync('userInfo');
        const currentUserId = userInfo ? userInfo.userId : null;
        
        if (!currentUserId) {
            // 扫码前已经做了友好提示，这里的提示可以更简洁。
            wx.showModal({
                title: '操作失败',
                content: '用户登录状态异常，请重新登录。',
                showCancel: false,
                confirmText: '好的',
            });
            return;
        }

        this.setData({ isChecking: true });
        wx.showLoading({ title: '正在查询...', mask: true });

        // ... 后续的 wx.cloud.callFunction 逻辑保持不变 ...
        wx.cloud.callFunction({
            name: 'checkBookingStatus',
            data: { 
                seatCode: seatCode,
                currentUserId: currentUserId // 传递当前用户ID
            },
            success: (res) => {
                console.log('云函数调用成功', res);
                const result = res.result;

                if (result.success) {
                    switch (result.status) {
                        case 'AVAILABLE':
                            wx.navigateTo({ url: `/pages/meal/food/index?code=${seatCode}` });
                            break;

                        case 'LOCKED_BUT_SELF_AVAILABLE_TEMP': // 用户自己的预订或锁定
                            {
                                let content = '此座位已被您锁定。';
                                if (result.bookDate) {
                                    // 预订时间如果有返回，则提示用户
                                    const bookTime = new Date(result.bookDate);
                                    const bookHours = bookTime.getHours().toString().padStart(2, '0');
                                    const bookMinutes = bookTime.getMinutes().toString().padStart(2, '0');
                                    const bookedAt = `${bookHours}:${bookMinutes}`;
                                    
                                    // 给出您要求的温馨提示
                                    content = `此座位已被您预订！您预约的时间是 ${bookedAt}，怎么这么早就来啦？您现在就可以入座哦！`;
                                } else if (result.vacateTime) {
                                     // 如果没有 bookDate 只有 vacateTime，也提示
                                     const vacateTime = new Date(result.vacateTime);
                                     const hours = vacateTime.getHours().toString().padStart(2, '0');
                                     const minutes = vacateTime.getMinutes().toString().padStart(2, '0');
                                     const usableUntilTime = `${hours}:${minutes}`;
                                     content = `此座位已被您预订！您最晚需在 ${usableUntilTime} 清场，现在就可以入座哦！`;
                                } else {
                                     content = '此座位已被您锁定，还想吃点啥吗?';
                                }
                                
                                wx.showModal({
                                    title: '温馨提示',
                                    content: content,
                                    confirmText: '去点餐',
                                    showCancel: false,
                                    success: (modalRes) => {
                                        if (modalRes.confirm) {
                                            wx.navigateTo({ url: `/pages/meal/food/index?code=${seatCode}` });
                                        }
                                    }
                                });
                            }
                            break;
                            
                        case 'LOCKED_BUT_AVAILABLE_TEMP':
                            {
                                const vacateTime = new Date(result.vacateTime);
                                const hours = vacateTime.getHours().toString().padStart(2, '0');
                                const minutes = vacateTime.getMinutes().toString().padStart(2, '0');
                                const usableUntilTime = `${hours}:${minutes}`;

                                wx.showModal({
                                    title: '温馨提示',
                                    content: `此座位有预订，您最晚可使用至 ${usableUntilTime}，到时需清场。是否继续使用？`,
                                    confirmText: '继续使用',
                                    cancelText: '放弃',
                                    success: (modalRes) => {
                                        if (modalRes.confirm) {
                                            wx.navigateTo({ url: `/pages/meal/food/index?code=${seatCode}` });
                                        }
                                    }
                                });
                            }
                            break;

                        case 'LOCKED_UNAVAILABLE':
                            {
                                // bookDate 字段在云函数中只有在 seats_book 有记录时才返回
                                const bookedTime = result.bookDate ? new Date(result.bookDate) : null;
                                
                                let content = result.message || '此座位当前已被占用，无法入座。';
                                
                                if (bookedTime) {
                                    const bookedHours = bookedTime.getHours().toString().padStart(2, '0');
                                    const bookedMinutes = bookedTime.getMinutes().toString().padStart(2, '0');
                                    const bookedAt = `${bookedHours}:${bookedMinutes}`;
                                    content = `此座位为 ${bookedAt} 的预订保留，已进入准备期，当前无法入座。`;
                                }

                                wx.showModal({
                                    title: '无法使用',
                                    content: content, 
                                    showCancel: false,
                                    confirmText: '好的'
                                });
                            }
                            break;

                        default:
                            wx.showToast({ title: '查询状态未知', icon: 'none' });
                            break;
                    }
                } else {
                    // 处理云函数返回 success: false 的情况 (如 INVALID_CODE 或被他人临时锁定)
                    wx.showModal({
                        title: '查询失败',
                        content: result.message || '发生未知错误，请重试',
                        showCancel: false,
                        confirmText: '好的'
                    });
                }
            },
            fail: (err) => {
                wx.showToast({ title: '网络错误，请重试', icon: 'none' });
            },
            complete: () => {
                wx.hideLoading();
                this.setData({ isChecking: false });
            }
        });
    }
});