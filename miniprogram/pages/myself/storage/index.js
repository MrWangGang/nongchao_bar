// index.js - 存酒页面逻辑

Page({
  data: {
      isModalVisible: false, // 控制模态框显示/隐藏
      currentDate: new Date().toISOString().split('T')[0], // 用于日期选择器的起始时间
      
      // 模态框表单数据
      formData: {
          imageUrl: '',       // 上传的图片URL
          wineName: '',       // 酒名
          validityDate: '',   // 有效期至
          remark: '',         // 备注 (最多10字)
      },
      
      // 示例列表数据 (用于模拟页面内容)
      wineList: [
          { orderNo: '4号', name: '格兰威特12年威士忌700ml', startDate: '2024-10-07', endDate: '2025-10-07', remark: 'x*x*x*x*x', status: '已确认寄存', quantity: 1 },
          { orderNo: '5号', name: '茅台飞天53度', startDate: '2024-11-01', endDate: '2026-11-01', remark: '朋友送的', status: '已确认寄存', quantity: 1 },
      ]
  },

  /**
   * 显示模态弹窗
   */
  showModal() {
      this.setData({
          isModalVisible: true,
          // 每次打开时，重置表单数据（可选）
          formData: {
              imageUrl: '',
              wineName: '',
              validityDate: '',
              remark: '',
          }
      });
  },

  /**
   * 隐藏模态弹窗
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
          count: 1, // 只允许选择一张图片
          mediaType: ['image'],
          sourceType: ['album', 'camera'],
          success(res) {
              const tempFilePath = res.tempFiles[0].tempFilePath;
              // 实际项目中，这里需要调用 wx.uploadFile 上传到服务器
              console.log('选择图片成功:', tempFilePath);

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
      // 由于 wxml 已经设置了 maxlength="10"，这里只做数据同步
      this.setData({
          'formData.remark': e.detail.value
      });
  },

  /**
   * 表单提交事件
   */
  submitForm(e) {
      const data = e.detail.value;
      const form = this.data.formData;

      // 整合表单数据 (input通过name绑定，picker和upload通过data绑定)
      const submitData = {
          ...data,
          imageUrl: form.imageUrl,
          validityDate: form.validityDate,
          // 备注在 input 中已同步，也可以直接从 data.remark 取
          remark: form.remark 
      };
      
      // 1. 简单的表单校验
      if (!submitData.wineName || !submitData.validityDate || !submitData.imageUrl) {
          wx.showToast({
              title: '请填写完整信息',
              icon: 'none'
          });
          return;
      }

      console.log('存酒数据提交:', submitData);

      // 2. 实际业务：调用 API 提交数据到服务器...
      
      // 3. 提交成功后：
      wx.showToast({
          title: '存酒成功',
          icon: 'success'
      });

      this.hideModal();
  }
});