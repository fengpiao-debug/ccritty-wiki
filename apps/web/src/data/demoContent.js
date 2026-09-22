// 文件作用：apps/web/src/data/demoContent.js，负责项目公共配置或辅助逻辑。
export const demoContent = {
  profile: {
    id: 'profile',
    type: 'profile',
    title: '歌手简介',
    artistName: 'Critty熙影',
    subtitle: 'Singer · Composer',
    heroImage: '',
    markdown:
      'Critty熙影，中国内地女歌手、音乐人。\\n\\n她的作品常以古典意象和现代编曲交织，形成细腻而有辨识度的声音。这里记录她的音乐、舞台、影像与行程。',
    updatedAt: '2026-09-22T00:00:00.000Z',
  },
  news: [
    {
      id: 'news-1',
      type: 'news',
      title: '新曲动态',
      publishedAt: '2026-09-22',
      sourceName: '官方发布',
      sourceUrl: '',
      cover: '',
      markdown: '新作与现场消息将在这里持续更新。',
    },
  ],
  events: [
    {
      id: 'event-1',
      type: 'event',
      title: '未来活动示例',
      startsAt: '2026-10-01T19:30:00.000Z',
      endsAt: '',
      city: '杭州',
      venue: '待公布',
      category: '演出',
      status: 'upcoming',
      ticketUrl: '',
      cover: '',
      markdown: '活动详情将在官方确认后更新。',
    },
  ],
  photos: [],
  songs: [
    {
      id: 'song-1',
      type: 'song',
      title: '牵丝戏',
      artist: 'Critty熙影 / Aki阿杰',
      releasedAt: '2015-01-01',
      album: '单曲',
      cover: '',
      audioUrl: '',
      lyrics: '',
      description: '经典作品资料。',
    },
  ],
  videos: [],
}
