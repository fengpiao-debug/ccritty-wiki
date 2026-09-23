// 文件作用：验证普通 LRC、多时间标签和逐字时间戳歌词的解析结果。
import { describe, expect, it } from 'vitest'
import { parseLyrics } from './lyrics'

describe('歌词解析', () => {
  it('保留普通逐行 LRC 的时间和文本', () => {
    expect(parseLyrics('[00:01.00]第一句\n[00:12.50]第二句')).toEqual([
      { time: 1, text: '第一句' },
      { time: 12.5, text: '第二句' },
    ])
  })

  it('逐字时间戳只显示一条整句歌词', () => {
    expect(parseLyrics('[00:54.91]临[00:55.16]界[00:55.42]望穿明月')).toEqual([
      { time: 54.91, text: '临界望穿明月' },
    ])
  })

  it('兼容多个时间标签对应同一句歌词', () => {
    expect(parseLyrics('[00:01.00][00:12.00]副歌')).toEqual([
      { time: 1, text: '副歌' },
      { time: 12, text: '副歌' },
    ])
  })
})
