// 动态添加下载按钮到卡片
function addDownloadButtonToCards() {
  document.querySelectorAll('.card').forEach(card => {
    // 检查是否已有下载按钮
    if (!card.querySelector('.download-image-btn')) {
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'download-image-btn';
      downloadBtn.innerHTML = '<i class="fas fa-download"></i> 下载图片';
      downloadBtn.title = '下载图片';
      
      // 添加到卡片底部
      const footer = card.querySelector('.card-footer');
      if (footer) {
        footer.appendChild(downloadBtn);
      }

      // 绑定点击事件
      downloadBtn.addEventListener('click', function() {
        const cardId = card.dataset.cardId;
        downloadCardImage(cardId);
      });
    }
  });
}

// 图片下载功能
async function downloadCardImage(cardId) {
  try {
    const card = document.querySelector(`.card[data-card-id="${cardId}"]`);
    const imageData = card.dataset.imageData;
    
    if (imageData) {
      const result = await window.electron.ipcRenderer.invoke('download-image', {
        base64Data: imageData,
        fileName: `card-${cardId}.png`
      });
      
      if (result.success) {
        showNotification('图片下载成功', 'success');
      } else {
        showNotification(`下载失败: ${result.error}`, 'error');
      }
    }
  } catch (error) {
    showNotification(`下载出错: ${error.message}`, 'error');
  }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始添加按钮
  addDownloadButtonToCards();
  
  // 监听卡片更新事件（如果有）
  document.addEventListener('cardsUpdated', addDownloadButtonToCards);
});