// === 类型定义 ===
export interface TweetItem {
  original: string;
  translation: string;
}

export interface DailyTweets {
  date: string;
  tweets: TweetItem[];
}

export interface HotTopic {
  topic: string;
  count: number;
  percentage: number;
}

export interface IndustryProportion {
  name: string;
  value: number;
}

export interface ConvictionStock {
  ticker: string;
  conviction_level: string;
  mention_count: number;
  investment_thesis: string;
}

export interface BottleneckItem {
  category: string;
  status: string;
  affected_tickers: string | string[];
}

export interface MappingNode {
  upstream: string;
  midstream: string;
  downstream: string;
}

export interface Kol {
  id: string;
  name: string;
}

export interface ReportData {
  user_id: string;
  range_days: number;
  last_updated: string;
  hot_topics: HotTopic[];
  industries: IndustryProportion[];
  conviction_watchlist: ConvictionStock[];
  supply_chain_bottlenecks: BottleneckItem[];
  value_chain_mapping: MappingNode[];
  data: DailyTweets[];
}

// === 百分比清理工具方法 ===
export const getCleanPercentage = (val: number): number => {
  const pct = val <= 1.0 ? val * 100 : val;
  return parseFloat(pct.toFixed(2));
};
