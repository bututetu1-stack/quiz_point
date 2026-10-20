// 画面から store（データ層）と部屋コードを参照するためのコンテキスト
import { createContext } from 'react';

export const RoomContext = createContext({ store: null, roomId: '', soundOn: false, setSoundOn: () => {}, online: {} });
