// scan.js
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

  scanCode: function() {
    if (this.data.isChecking) return;

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
    
    // 【修改点 1】从缓存获取 userInfo
    const userInfo = wx.getStorageSync('userInfo');
    // 【修改点 2】尝试从 userInfo 中提取 userId
    const currentUserId = userInfo ? userInfo.userId : null;
    
    if (!currentUserId) {
        wx.showModal({
            title: '操作失败',
            content: '未获取到用户ID，请先登录或授权。',
            showCancel: false,
        });
        return;
    }

    this.setData({ isChecking: true });
    wx.showLoading({ title: '正在查询...', mask: true });


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