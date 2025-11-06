// index.js - 存酒页面逻辑

Page({
  data: {
      isModalVisible: false, // 控制模态框显示/隐藏
      currentDate: new Date().toISOString().split('T')[0], // 用于日期选择器的起始时间
      
      // 【新增】: 当前选中的 Tab (0: 未取出存酒, 1: 历史存酒)
      currentTab: 0, 
      
      // 模态框表单数据
      formData: {
          imageUrl: '',       // 上传的图片URL
          wineName: '',       // 酒名
          validityDate: '',   // 有效期至
          remark: '',         // 备注 (最多25字)
      },
      
      // 示例列表数据 (共 11 条未取出 + 1 条已取出 = 12 条)
      wineList: [
          // --- 1 条历史数据 ---
          { 
              orderNo: '5号', 
              depositTime: '2024-11-01 10:00:00', // 寄存时间
              withdrawTime: '2024-11-05 15:30:00', // 已取出，有取酒时间
              depositTimeDisplay: '2024-11-01', // 用于显示
              withdrawTimeDisplay: '2024-11-05', // 用于显示
              name: '茅台飞天53度', 
              endDate: '2026-11-01', // 有效期至
              remark: '朋友送的', 
              status: '已取出', 
              imageUrl: 'https://cdn.example.com/wine5.jpg',
              quantity: 1
          },
          // --- 11 条未取出数据 ---
          { 
              orderNo: '4号', 
              depositTime: '2024-11-04 10:00:00', 
              withdrawTime: null, 
              depositTimeDisplay: '2024-11-04',
              withdrawTimeDisplay: null,
              name: '拉菲古堡2018', 
              endDate: '2028-11-04', 
              remark: '生日礼物，舍不得喝', 
              status: '已确认寄存', 
              imageUrl: 'https://cdn.example.com/wine4.jpg',
              quantity: 2
          },
          { 
              orderNo: '3号', 
              depositTime: '2024-11-03 10:00:00', 
              withdrawTime: null, 
              depositTimeDisplay: '2024-11-03',
              withdrawTimeDisplay: null,
              name: '五粮液', 
              endDate: '2027-11-03', 
              remark: '宴会预留', 
              status: '已确认寄存', 
              imageUrl: 'https://cdn.example.com/wine3.jpg',
              quantity: 6
          },
          { 
              orderNo: '2号', 
              depositTime: '2024-11-02 10:00:00', 
              withdrawTime: null, 
              depositTimeDisplay: '2024-11-02',
              withdrawTimeDisplay: null,
              name: '奔富407', 
              endDate: '2029-11-02', 
              remark: '酒精度较高', 
              status: '已确认寄存', 
              imageUrl: 'https://cdn.example.com/wine2.jpg',
              quantity: 3
          },
          { 
              orderNo: '1号', 
              depositTime: '2024-11-01 10:00:00', 
              withdrawTime: null, 
              depositTimeDisplay: '2024-11-01',
              withdrawTimeDisplay: null,
              name: '剑南春', 
              endDate: '2026-05-01', 
              remark: '老朋友聚会喝', 
              status: '已确认寄存', 
              imageUrl: 'https://cdn.example.com/wine1.jpg',
              quantity: 1
          },
          // 额外的测试数据
          { orderNo: '6号', depositTime: '2024-10-31 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-31', withdrawTimeDisplay: null, name: '西拉干红', endDate: '2025-10-31', remark: '尽快喝完', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine6.jpg', quantity: 2 },
          { orderNo: '7号', depositTime: '2024-10-30 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-30', withdrawTimeDisplay: null, name: '清酒', endDate: '2025-04-30', remark: '适合配寿司', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine7.jpg', quantity: 1 },
          { orderNo: '8号', depositTime: '2024-10-29 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-29', withdrawTimeDisplay: null, name: '轩尼诗', endDate: '2030-10-29', remark: '送领导的酒', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine8.jpg', quantity: 1 },
          { orderNo: '9号', depositTime: '2024-10-28 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-28', withdrawTimeDisplay: null, name: '皇家礼炮', endDate: '2031-10-28', remark: '高档酒', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine9.jpg', quantity: 1 },
          { orderNo: '10号', depositTime: '2024-10-27 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-27', withdrawTimeDisplay: null, name: '威士忌', endDate: '2027-10-27', remark: '自饮', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine10.jpg', quantity: 1 },
          { orderNo: '11号', depositTime: '2024-10-26 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-26', withdrawTimeDisplay: null, name: '伏特加', endDate: '2026-10-26', remark: '调鸡尾酒', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine11.jpg', quantity: 1 },
          { orderNo: '12号', depositTime: '2024-10-25 10:00:00', withdrawTime: null, depositTimeDisplay: '2024-10-25', withdrawTimeDisplay: null, name: '桃红葡萄酒', endDate: '2025-03-25', remark: '清爽', status: '已确认寄存', imageUrl: 'https://cdn.example.com/wine12.jpg', quantity: 1 },
      ],
      // 列表中展示的数据 (初始显示“未取出存酒”列表)
      displayList: [], 
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad() {
      // 初始化 displayList，只显示 '已确认寄存' 的酒
      this.setData({
          displayList: this.data.wineList.filter(item => item.status === '已确认寄存')
      });
  },

  /**
   * 切换 Tab
   */
  switchTab(e) {
      const index = parseInt(e.currentTarget.dataset.index);
      this.setData({
          currentTab: index,
          // 根据选中的 Tab 过滤列表
          displayList: this.data.wineList.filter(item => item.status === (index === 0 ? '已确认寄存' : '已取出'))
      });
  },

  /**
   * 显示模态弹窗
   */
  showModal() {
      // 重置表单数据
      this.setData({
          isModalVisible: true,
          formData: {
              imageUrl: '',
              wineName: '',
              validityDate: '',
              remark: '',
          }
      });
  },

  /**
   * 隐藏模态弹窗 (用于点击取消或背景遮罩)
   */
  hideModal() {
      this.setData({
          isModalVisible: false,
      });
  },

  /**
   * 图片上传：选择图片
   */
  chooseImage() {
      const that = this;
      wx.chooseMedia({
          count: 1, 
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success(res) {
              const tempFilePath = res.tempFiles[0].tempFilePath;
              that.setData({
                  'formData.imageUrl': tempFilePath
              });
          }
      });
  },

  /**
   * 日期选择器改变事件
   */
  bindDateChange(e) {
      this.setData({
          'formData.validityDate': e.detail.value
      });
  },

  /**
   * 备注输入事件 (实时更新字数)
   */
  bindRemarkInput(e) {
      this.setData({
          'formData.remark': e.detail.value
      });
  },

  /**
   * 表单提交事件 - 添加确认弹框
   */
  submitForm(e) {
      const data = e.detail.value;
      const form = this.data.formData;

      // 【修复】使用 Object.assign 替代对象展开运算符
      const submitData = Object.assign({}, data, {
          imageUrl: form.imageUrl,
          validityDate: form.validityDate,
          remark: form.remark 
      });
      
      // 1. 校验数据
      if (!submitData.wineName || !submitData.validityDate || !submitData.imageUrl) {
          wx.showToast({
              title: '请填写完整信息并上传图片',
              icon: 'none'
          });
          return;
      }

      // 2. 确认弹框逻辑
      wx.showModal({
          title: '确认存酒',
          content: `确认存入：${submitData.wineName}？`,
          confirmText: '确认存酒',
          cancelText: '取消',
          success: (res) => {
              if (res.confirm) {
                  // 用户点击确认，执行真正的提交逻辑
                  this.processSubmission(submitData);
              } else if (res.cancel) {
                  console.log('用户取消存酒');
              }
          }
      });
  },

  /**
   * 处理实际提交的函数
   */
  processSubmission(submitData) {
      // 模拟生成寄存单号
      const orderNo = (Math.random() * 10000).toFixed(0).padStart(4, '0');

      // 模拟存酒数据，加入当前未取出列表
      const newWine = {
          orderNo: orderNo, 
          depositTime: new Date().toISOString(), // 存酒的原始时间
          depositTimeDisplay: new Date().toISOString().split('T')[0], // 存酒的显示时间
          withdrawTime: null,
          withdrawTimeDisplay: null,
          name: submitData.wineName, 
          endDate: submitData.validityDate, 
          remark: submitData.remark || '无', 
          status: '已确认寄存', 
          imageUrl: submitData.imageUrl,
          quantity: 1 // 默认存入数量为1
      };

      // 【修复】使用 Array.prototype.concat 替代数组展开运算符
      const newList = [newWine].concat(this.data.wineList);

      this.setData({
          wineList: newList,
          // 重新过滤列表
          displayList: newList.filter(item => item.status === (this.data.currentTab === 0 ? '已确认寄存' : '已取出')),
          isModalVisible: false, // 隐藏模态框
      }, () => {
          wx.showToast({
              title: '存酒成功',
              icon: 'success'
          });
      });
  },

  /**
   * 立刻取酒按钮事件
   */
  withdrawWine(e) {
      const index = e.currentTarget.dataset.index;
      const wineToWithdraw = this.data.displayList[index];

      wx.showModal({
          title: '确认取酒',
          content: `确认取出 ${wineToWithdraw.name} 吗？`,
          success: (res) => {
              if (res.confirm) {
                  const now = new Date();
                  const nowDisplay = now.toISOString().split('T')[0];

                  const updatedWineList = this.data.wineList.map(item => {
                      if (item.orderNo === wineToWithdraw.orderNo) {
                           // 【修复】使用 Object.assign 替代对象展开运算符
                          return Object.assign({}, item, {
                              status: '已取出',
                              withdrawTime: now.toISOString(),
                              withdrawTimeDisplay: nowDisplay
                          });
                      }
                      return item;
                  });

                  this.setData({
                      wineList: updatedWineList,
                      // 重新过滤当前显示的列表
                      displayList: updatedWineList.filter(item => item.status === (this.data.currentTab === 0 ? '已确认寄存' : '已取出'))
                  }, () => {
                      wx.showToast({
                          title: '取酒成功',
                          icon: 'success'
                      });
                  });
              }
          }
      });
  }
})