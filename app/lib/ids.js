// 部屋コード・トークン・ID の生成

export const ROOM_CODE_LEN = 4;
export const genRoomCode = () => {
  let s = '';
  for (let i = 0; i < ROOM_CODE_LEN; i++) s += Math.floor(Math.random() * 10);
  return s;
};
export const genToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
export const genId = (p) => p + '_' + Math.random().toString(36).slice(2, 10);
