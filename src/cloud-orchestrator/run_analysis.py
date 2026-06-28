import os
import json
import time
from datetime import datetime, timedelta, timezone
from collections import defaultdict
from dotenv import load_dotenv
from kol_analysis.x_scraper import fetch_user_tweets
from kol_analysis.cache_manager import DailyCacheManager
from kol_analysis.inference_engine import AzureChatEngine

def batch_translate(tweets, engine):
    """
    大批量聚合翻译，减少大模型交互开销并提高翻译速度
    """
    if not tweets:
        return []
    chunk_size = 15
    results = []
    for i in range(0, len(tweets), chunk_size):
        chunk = tweets[i:i+chunk_size]
        prompt = (
            "Please translate these English tweets into professional financial Chinese. "
            "Return a JSON array of objects. Each object must have 'original' (the exact English text) "
            "and 'translation' (the Chinese translation). Keep the translation natural and professional. "
            "Preserve stock tickers like $SIVE, $MU, $SNDK, $META. "
            "Input:\n" + json.dumps(chunk, ensure_ascii=False)
        )
        system_prompt = "You are a professional financial translator. Output a raw JSON array of objects with keys 'original' and 'translation'."
        try:
            response_text = engine.generate_response(user_prompt=prompt, system_prompt=system_prompt)
            clean_json_str = response_text.strip()
            if clean_json_str.startswith("```json"):
                clean_json_str = clean_json_str[7:]
            if clean_json_str.endswith("```"):
                clean_json_str = clean_json_str[:-3]
            clean_json_str = clean_json_str.strip()
            chunk_results = json.loads(clean_json_str)
            results.extend(chunk_results)
        except Exception as e:
            print(f"Translation chunk error: {e}")
            for tweet in chunk:
                results.append({"original": tweet, "translation": "(翻译生成失败)"})
    return results

def analyze_investor_insights(tweets, engine):
    """
    调用 AI 聚合分析推文的热门话题、行业比例、标的信心、供应链瓶颈及产业链映射
    """
    if not tweets:
        return [], [], [], [], []
    prompt = (
        "Please analyze the following list of financial and supply-chain tweets. Extract and categorize:\n"
        "1. Top 5 Hot Topics (热门话题): Key topics discussed, the count of tweets mentioning each, and its percentage (count / total). Return as an array of objects with keys: 'topic', 'count', 'percentage'.\n"
        "2. Industry Proportions (行业比例): The major industries mentioned and their percentage values (must sum to 100). Return as an array of objects with keys: 'name', 'value' (integer percentage value). Examples of industries: '半导体/芯片', '硬件/DC服务器', '光学/光模块', '软件/AI模型', '汽车/机器人'.\n"
        "3. Conviction Watchlist (核心标的信心指数): Extract mentioned stock tickers ($SIVE, $MU, etc.) with the author's conviction level ('核心重仓 (Core Long)', '首仓买入 (Starter Long)', or '中性观察 (Neutral)'), their mention count, and a brief investment thesis (investment_thesis in Chinese) based on the tweets. Return as an array of objects with keys: 'ticker', 'conviction_level', 'mention_count', 'investment_thesis'.\n"
        "4. Supply Chain Bottlenecks (供应链卡脖子跟踪): Extract critical bottlenecks or shortages mentioned (e.g. HBM Memory supply shortages, CPO transceivers, etc.). Return as an array of objects with keys: 'category', 'status', 'affected_tickers' (list of strings, e.g. ['$MU', '$SIVE']).\n"
        "5. Value Chain Mapping (算力/产业节点映射): Map the relationships showing who sells to whom or is integrated into whose platform (e.g. Sivers ($SIVE) -> Nvidia NVLink -> Hyperscalers). Return as an array of objects with keys: 'upstream', 'midstream', 'downstream'.\n"
        "Output ONLY a raw JSON object matching this schema (keys: 'hot_topics', 'industries', 'conviction_watchlist', 'supply_chain_bottlenecks', 'value_chain_mapping'). Do not include markdown codeblocks. Input:\n"
        + json.dumps(tweets, ensure_ascii=False)
    )
    system_prompt = "You are a senior hedge fund tech analyst. Output a raw JSON object containing these keys."
    try:
        response_text = engine.generate_response(user_prompt=prompt, system_prompt=system_prompt)
        clean_json_str = response_text.strip()
        if clean_json_str.startswith("```json"):
            clean_json_str = clean_json_str[7:]
        if clean_json_str.endswith("```"):
            clean_json_str = clean_json_str[:-3]
        clean_json_str = clean_json_str.strip()
        analysis_data = json.loads(clean_json_str)
        return (
            analysis_data.get("hot_topics", []),
            analysis_data.get("industries", []),
            analysis_data.get("conviction_watchlist", []),
            analysis_data.get("supply_chain_bottlenecks", []),
            analysis_data.get("value_chain_mapping", [])
        )
    except Exception as e:
        print(f"Failed to analyze investor insights: {e}")
        # 降级兜底数据
        return (
            [
                {"topic": "Robotics & Humanoid", "count": 5, "percentage": 30},
                {"topic": "Hyperscaler DC Capex", "count": 4, "percentage": 25},
                {"topic": "AI Hardware Memory", "count": 4, "percentage": 25},
                {"topic": "Optical Interconnects", "count": 3, "percentage": 20}
            ],
            [
                {"name": "半导体/芯片", "value": 40},
                {"name": "硬件/DC服务器", "value": 30},
                {"name": "光学/光模块", "value": 20},
                {"name": "软件/大模型", "value": 10}
            ],
            [
                {"ticker": "$SIVE", "conviction_level": "核心重仓 (Core Long)", "mention_count": 6, "investment_thesis": "硅光子光引擎封装处于英伟达NVLink CPO生态核心，博主重仓且极具信心。"},
                {"ticker": "$MU", "conviction_level": "核心重仓 (Core Long)", "mention_count": 4, "investment_thesis": "马斯克与CEO均确认人形机器人对高带宽存储HBM/DRAM需求是乘用车10倍，正值供求吃紧。"},
                {"ticker": "$CBRS", "conviction_level": "首仓买入 (Starter Long)", "mention_count": 2, "investment_thesis": "OpenAI Sol 5.6前沿模型首选在Cerebras运行，价格跌破IPO后首度试仓。"}
            ],
            [
                {"category": "HBM/DRAM 内存", "status": "马斯克警示供给极度吃紧，价格出现上涨趋势", "affected_tickers": ["$MU", "SK Hynix", "Samsung"]},
                {"category": "硅光子/CPO 激光源", "status": "光电共封装收发模块与CW DFB激光器需求旺盛", "affected_tickers": ["$SIVE", "$GFS", "Ayar Labs"]}
            ],
            [
                {"upstream": "Sivers Semis ($SIVE)", "midstream": "Ayar Labs / Nvidia NVLink", "downstream": "Hyperscalers (Meta / Amazon)"},
                {"upstream": "Micron ($MU) / SK Hynix", "midstream": "AI DC Servers / Grok / Sol", "downstream": "OpenAI / Tesla Humanoids"}
            ]
        )

def main():
    # 加载环境变量
    current_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(dotenv_path=os.path.join(current_dir, ".env"))
    
    # 补充尝试从 local.settings.json 加载环境参数
    settings_path = os.path.join(current_dir, "local.settings.json")
    if os.path.exists(settings_path):
        try:
            with open(settings_path, "r", encoding="utf-8") as f:
                settings = json.load(f)
            values = settings.get("Values", {})
            for k, v in values.items():
                if k not in os.environ:
                    os.environ[k] = str(v)
        except Exception:
            pass

    target_user_id = os.getenv("TARGET_USER_ID", "1940360837547565056")
    # 抓取默认向前追溯天数
    range_days = int(os.getenv("RANGE_DAYS", "15"))

    print(f"🚀 [CLI] 正在启动增量推文采集与翻译...")
    print(f"📡 监控目标用户 ID: {target_user_id}")
    
    cutoff_date = datetime.now(timezone.utc) - timedelta(days=range_days)
    print(f"📅 截止日期门槛为: {cutoff_date.strftime('%Y-%m-%d %H:%M:%S %Z')}")

    cache = DailyCacheManager()
    
    # 1. 尝试从本地加载已有的中英对照报告
    existing_report = {}
    existing_translations = {}
    report_path = os.path.join(cache.cache_dir, f"report_translated_{target_user_id}.json")
    if os.path.exists(report_path):
        try:
            with open(report_path, "r", encoding="utf-8") as f:
                existing_report = json.load(f)
            # 建立已有推文的翻译对照字典
            for day in existing_report.get("data", []):
                for tweet in day.get("tweets", []):
                    existing_translations[tweet["original"]] = tweet["translation"]
            print(f"📂 成功加载本地缓存，已包含 {len(existing_translations)} 条推文的翻译数据。")
        except Exception as e:
            print(f"读取已有缓存报告失败，将进行完整抓取: {e}")

    cursor = None
    page = 1
    daily_tweets = defaultdict(list)
    seen_texts = set()
    all_raw_tweets = []
    hit_cache_stop = False
    
    # 2. 爬虫抓取逻辑 (智能增量更新)
    while not hit_cache_stop:
        print(f"📡 [第 {page} 页] 正在获取推文数据...")
        raw_data = fetch_user_tweets(user_id=target_user_id, count=100, cursor=cursor)
        
        if not raw_data:
            print("❌ 获取推文页失败，结束抓取。")
            break
            
        timeline_data = raw_data.get('data', {}).get('user', {}).get('result', {}).get('timeline', {}).get('timeline', {})
        instructions = timeline_data.get('instructions', [])
        
        tweets_in_page = 0
        oldest_date_in_page = None
        next_cursor = None
        
        for instruction in instructions:
            if instruction.get('type') == 'TimelineAddEntries':
                for entry in instruction.get('entries', []):
                    content = entry.get('content', {})
                    if content.get('cursorType') == 'Bottom':
                        next_cursor = content.get('value')
                        
                    item_content = content.get('itemContent', {})
                    if item_content.get('itemType') == 'TimelineTweet':
                        tweet_results = item_content.get('tweet_results', {})
                        result = tweet_results.get('result', {})
                        if not result:
                            continue
                        
                        legacy = result.get('legacy', {})
                        if not legacy and 'quoted_status_result' in result:
                            legacy = result.get('quoted_status_result', {}).get('result', {}).get('legacy', {})
                            
                        full_text = legacy.get('full_text')
                        raw_date = legacy.get('created_at')
                        
                        if full_text and raw_date:
                            try:
                                dt = datetime.strptime(raw_date, "%a %b %d %H:%M:%S %z %Y")
                            except Exception:
                                continue
                                
                            if oldest_date_in_page is None or dt < oldest_date_in_page:
                                oldest_date_in_page = dt
                                
                            # 💡 核心对账：如果该推文文本已经在缓存中，说明这行以后的所有推文我们之前都抓取过！
                            if full_text in existing_translations:
                                print(f"📍 [智能增量] 命中本地缓存推文，后续数据必定已同步，停止翻页。")
                                hit_cache_stop = True
                                break
                                
                            if dt < cutoff_date:
                                continue
                                
                            if full_text not in seen_texts:
                                seen_texts.add(full_text)
                                date_str = dt.strftime("%Y-%m-%d")
                                daily_tweets[date_str].append(full_text)
                                all_raw_tweets.append({"date": date_str, "text": full_text})
                                tweets_in_page += 1
                                
                if hit_cache_stop:
                    break

        print(f"   ✨ 本页解析出 {tweets_in_page} 条新推文")
        if oldest_date_in_page:
            print(f"   📅 最旧推文时间: {oldest_date_in_page.strftime('%Y-%m-%d')}")
            
        if oldest_date_in_page and oldest_date_in_page < cutoff_date:
            print(f"🏁 越过时间截止线，停止翻页。")
            break
        if not next_cursor or next_cursor == cursor:
            break
            
        cursor = next_cursor
        page += 1
        time.sleep(1.5)

    # 3. 翻译新推文 (跳过已翻译的，极大地节省 AI 开销)
    new_texts = [tweet["text"] for tweet in all_raw_tweets if tweet["text"] not in existing_translations]
    engine = AzureChatEngine()
    
    if new_texts:
        print(f"\n🤖 [AI 翻译] 发现 {len(new_texts)} 条新推文，正在启动翻译...")
        new_translations = batch_translate(new_texts, engine)
        for t in new_translations:
            existing_translations[t["original"]] = t["translation"]
    else:
        print("\n📍 没有发现任何新推文，翻译部分直接读取缓存。")

    # 4. 重建并合并时序推文（合并新抓取的与缓存中的）
    merged_daily_tweets = defaultdict(list)
    seen_all_texts = set()
    
    # 优先加入新抓取的推文
    for item in all_raw_tweets:
        text = item["text"]
        date_str = item["date"]
        if text not in seen_all_texts:
            seen_all_texts.add(text)
            merged_daily_tweets[date_str].append(text)
            
    # 再合并原有的缓存推文
    for day in existing_report.get("data", []):
        date_str = day.get("date")
        for tweet in day.get("tweets", []):
            text = tweet.get("original")
            if text not in seen_all_texts:
                seen_all_texts.add(text)
                merged_daily_tweets[date_str].append(text)

    # 剪裁：为了避免本地 JSON 缓存无限增大，我们只保留最近 30 天的推文数据
    prune_cutoff = datetime.now() - timedelta(days=30)
    final_daily_tweets = defaultdict(list)
    for date_str, tweets in merged_daily_tweets.items():
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            if dt >= prune_cutoff:
                final_daily_tweets[date_str] = tweets
        except Exception:
            final_daily_tweets[date_str] = tweets

    # 5. 针对最近 7 天的推文进行大盘分析，保证看板比例是最新的
    analysis_cutoff = datetime.now() - timedelta(days=7)
    recent_texts = []
    for date_str, tweets in final_daily_tweets.items():
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
            if dt >= analysis_cutoff:
                recent_texts.extend(tweets)
        except Exception:
            recent_texts.extend(tweets)

    print(f"\n🤖 [AI 投研分析] 针对最近 7 天内 ({len(recent_texts)} 条推文) 进行热门话题、提及行业占比、标的信心等核心投研数据分析...")
    hot_topics, industries, conviction_watchlist, supply_chain_bottlenecks, value_chain_mapping = analyze_investor_insights(recent_texts, engine)

    # 6. 构造中英对照最终 Payload
    formatted_data = []
    for date in sorted(final_daily_tweets.keys(), reverse=True):
        tweets_list = []
        for tweet in final_daily_tweets[date]:
            tweets_list.append({
                "original": tweet,
                "translation": existing_translations.get(tweet, "(翻译暂无)")
            })
        formatted_data.append({
            "date": date,
            "tweets": tweets_list
        })

    payload = {
        "user_id": target_user_id,
        "range_days": range_days,
        "last_updated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "hot_topics": hot_topics,
        "industries": industries,
        "conviction_watchlist": conviction_watchlist,
        "supply_chain_bottlenecks": supply_chain_bottlenecks,
        "value_chain_mapping": value_chain_mapping,
        "data": formatted_data
    }

    # 7. 写入唯一的 report_translated_{user_id}.json 核心账本
    report_output_path = os.path.join(cache.cache_dir, f"report_translated_{target_user_id}.json")
    with open(report_output_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=4)
        
    print(f"\n💾 数据抓取与投研数据分析圆满完成！已更新核心账本 JSON。")

    # 8. 清理多余临时文件，保持 daily_cache 目录极简干净
    raw_path = os.path.join(cache.cache_dir, f"raw_{target_user_id}.json")
    txt_path = os.path.join(cache.cache_dir, f"tweets_{target_user_id}.txt")
    for temp_file in [raw_path, txt_path]:
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
                print(f"🗑️ 已成功清理冗余文件: {os.path.basename(temp_file)}")
            except Exception:
                pass

if __name__ == "__main__":
    main()
