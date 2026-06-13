export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  return dateStr.slice(0, 10);
}

export function getSpeciesTag(species: string): { className: string; text: string } {
  switch (species) {
    case '猫': return { className: 'tag-cat', text: '猫咪' };
    case '狗': return { className: 'tag-dog', text: '狗狗' };
    case '异宠': return { className: 'tag-other', text: '异宠' };
    default: return { className: 'tag-other', text: species };
  }
}

export function getStatusTag(status: string): { className: string; text: string } {
  switch (status) {
    case 'open': return { className: 'tag-open', text: '招募中' };
    case 'matched': return { className: 'tag-matched', text: '已匹配' };
    case 'completed': return { className: 'tag-completed', text: '已完成' };
    default: return { className: '', text: status };
  }
}

export function getAppStatusText(status: string): string {
  switch (status) {
    case 'pending': return '待审核';
    case 'accepted': return '已通过';
    case 'rejected': return '未通过';
    default: return status;
  }
}
