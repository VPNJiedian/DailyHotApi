import type { RouterData, ListContext, Options, RouterResType } from "../types.js";
import type { RouterType } from "../router.types.js";
import { get } from "../utils/getData.js";

const typeMap: Record<string, string> = {
  realtime: "热搜",
  novel: "小说",
  movie: "电影",
  teleplay: "电视剧",
  car: "汽车",
  game: "游戏",
};

export const handleRoute = async (c: ListContext, noCache: boolean) => {
  const type = c.req.query("type") || "realtime";
  const listData = await getList({ type }, noCache);
  const routeData: RouterData = {
    name: "baidu",
    title: "百度",
    type: typeMap[type],
    params: {
      type: {
        name: "热搜类别",
        type: typeMap,
      },
    },
    link: "https://top.baidu.com/board",
    total: listData.data?.length || 0,
    ...listData,
  };
  return routeData;
};

const getList = async (options: Options, noCache: boolean): Promise<RouterResType> => {
  const { type } = options;
  // 使用百度官方的API接口，这个更稳定
  const url = `https://top.baidu.com/api/board?platform=pc&tab=${type}`;
  
  const result = await get({
    url,
    noCache,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
      "Referer": "https://top.baidu.com/",
      "Accept": "application/json, text/plain, */*",
    },
  });

  try {
    // 直接解析API返回的JSON数据
    const apiData = result.data;
    
    // 根据API返回的实际结构调整数据提取路径
    // 常见的返回格式: {code:0, data: {cards: [...]}} 或 {success:true, list: [...]}
    let hotList = [];
    
    if (apiData.data?.cards) {
      // 格式1: data.cards 包含数据
      const cards = apiData.data.cards;
      for (const card of cards) {
        if (card.content && Array.isArray(card.content)) {
          hotList = [...hotList, ...card.content];
        }
      }
    } else if (apiData.data?.list) {
      // 格式2: data.list 直接是数组
      hotList = apiData.data.list;
    } else if (Array.isArray(apiData.list)) {
      // 格式3: list 直接是数组
      hotList = apiData.list;
    } else if (apiData.data && Array.isArray(apiData.data)) {
      // 格式4: data 直接是数组
      hotList = apiData.data;
    }

    return {
      ...result,
      data: hotList.map((item: any, index: number) => {
        // 处理不同字段名的可能性
        const title = item.word || item.title || item.query || item.name || "";
        const hotScore = item.hotScore || item.hot || item.hotCount || item.score || 0;
        const url = item.url || item.link || item.href || `https://www.baidu.com/s?wd=${encodeURIComponent(title)}`;
        const desc = item.desc || item.description || item.summary || "";
        const img = item.img || item.pic || item.image || item.imgInfo?.src || "";
        const author = item.author || item.show || item.source || "";

        return {
          id: item.index || item.id || index + 1,
          title,
          desc,
          cover: img,
          author: Array.isArray(author) ? author.join(",") : author,
          timestamp: item.pubTime || item.timestamp || 0,
          hot: parseInt(hotScore.toString(), 10) || 0,
          url: url.startsWith("http") ? url : `https://www.baidu.com${url}`,
          mobileUrl: item.mobileUrl || item.murl || url || "",
        };
      }),
    };
  } catch (error) {
    console.error("百度API解析失败:", error);
    // 如果API失败，返回空数据而不是崩溃
    return {
      ...result,
      data: [],
    };
  }
};
